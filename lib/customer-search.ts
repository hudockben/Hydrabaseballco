// Search for the Customer List.
//
// One box does everything: plain words match anywhere, `field:value` narrows to
// a column, `has:` / `missing:` filter on what's filled in, `tier:` and
// `status:` filter the reach-out queue, `-word` excludes, and "quoted phrases"
// match exactly. Results are ranked by relevance *and* tier, so a name search
// finds the school and an open-ended search surfaces the best leads first.

import {
  divisionKey,
  DIVISION_LABELS,
  hasWarmConnection,
  stateAbbr,
  STATE_NAMES,
  statusOf,
  CUSTOMER_STATUSES,
  type CustomerRecord,
  type CustomerStatus,
} from './customers';
import { normalizeTier, type ScoredCustomer, type Tier } from './customer-tiers';

export type SearchField =
  | 'any' | 'state' | 'school' | 'conference' | 'division' | 'connection'
  | 'instagram' | 'email' | 'coach' | 'phone' | 'notes' | 'link';

export type FlagKey =
  | 'email' | 'phone' | 'coach' | 'instagram' | 'roster' | 'connection'
  | 'contact' | 'notes' | 'website';

export interface QueryTerm {
  field: SearchField;
  text: string;
  negate: boolean;
}

export interface SearchChip {
  label: string;
  kind: 'term' | 'field' | 'flag' | 'tier' | 'status' | 'exclude';
}

export interface ParsedQuery {
  raw: string;
  terms: QueryTerm[];
  has: FlagKey[];
  missing: FlagKey[];
  tiers: Tier[];
  notTiers: Tier[];
  statuses: CustomerStatus[];
  notStatuses: CustomerStatus[];
  chips: SearchChip[];
  isEmpty: boolean;
}

const FIELD_ALIASES: Record<string, SearchField> = {
  state: 'state', st: 'state', in: 'state',
  school: 'school', name: 'school', team: 'school', college: 'school', university: 'school',
  conf: 'conference', conference: 'conference', league: 'conference',
  div: 'division', division: 'division', level: 'division',
  conn: 'connection', connection: 'connection', contact1: 'connection', who: 'connection',
  ig: 'instagram', insta: 'instagram', instagram: 'instagram',
  email: 'email', mail: 'email',
  coach: 'coach',
  phone: 'phone', tel: 'phone',
  note: 'notes', notes: 'notes',
  link: 'link', roster: 'link', site: 'link', website: 'link', url: 'link',
};

const FLAG_ALIASES: Record<string, FlagKey> = {
  email: 'email', mail: 'email',
  phone: 'phone', tel: 'phone',
  coach: 'coach', contactname: 'coach',
  ig: 'instagram', insta: 'instagram', instagram: 'instagram',
  roster: 'roster', rosterlink: 'roster',
  conn: 'connection', connection: 'connection',
  contact: 'contact',
  note: 'notes', notes: 'notes',
  site: 'website', website: 'website', url: 'website',
};

/** One-click searches — they fill the box so the syntax is learnable. */
export const QUICK_SEARCHES: Array<{ label: string; query: string; hint: string }> = [
  { label: 'Warm connections', query: 'has:connection', hint: 'Schools where you already know someone' },
  { label: 'Ready to email', query: 'has:email status:new', hint: 'Contact on file, not reached out yet' },
  { label: 'Needs contact info', query: 'missing:contact', hint: 'No email, phone, or Instagram yet' },
  { label: 'Waiting on a reply', query: 'status:contacted', hint: 'Reached out, no answer yet' },
  { label: 'In play', query: 'status:replied status:interested', hint: 'They answered — keep it moving' },
];

const QUOTED_TOKEN_RE = /(?:[^\s"]+|"[^"]*")+/g;
const unquote = (s: string) => s.replace(/"/g, '').trim();

/** Turn the search box text into a structured query. Never throws. */
export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = {
    raw, terms: [], has: [], missing: [], tiers: [], notTiers: [],
    statuses: [], notStatuses: [], chips: [], isEmpty: true,
  };
  const tokens = raw.match(QUOTED_TOKEN_RE) ?? [];

  for (const token of tokens) {
    let body = token;
    let negate = false;
    if (body.startsWith('-') && body.length > 1) {
      negate = true;
      body = body.slice(1);
    }
    const colon = body.indexOf(':');
    if (colon > 0) {
      const key = body.slice(0, colon).toLowerCase().replace(/[^a-z0-9]/g, '');
      const value = unquote(body.slice(colon + 1)).toLowerCase();
      if (value && addOperator(q, key, value, negate)) continue;
      // Half-typed operator ("state:") — ignore it instead of searching for the
      // literal text, which would blank the list mid-keystroke.
      if (!value && isOperator(key)) continue;
    }
    const text = unquote(body).toLowerCase();
    if (!text) continue;
    q.terms.push({ field: 'any', text, negate });
    q.chips.push({ label: negate ? `not “${text}”` : `“${text}”`, kind: negate ? 'exclude' : 'term' });
  }

  q.isEmpty =
    !q.terms.length && !q.has.length && !q.missing.length &&
    !q.tiers.length && !q.notTiers.length && !q.statuses.length && !q.notStatuses.length;
  return q;
}

const FLAG_KEYS = ['has', 'with', 'no', 'missing', 'without', 'needs'];

/** Is this a `key:` the parser understands (so `key:` alone can be ignored)? */
function isOperator(key: string): boolean {
  return FLAG_KEYS.includes(key) || key === 'tier' || key === 'status' || key === 'stage' || key in FIELD_ALIASES;
}

/** Handle `field:value`, `has:x`, `tier:a`, `status:new`. Returns false if unknown. */
function addOperator(q: ParsedQuery, key: string, value: string, negate: boolean): boolean {
  const values = value.split(/[,\s]+/).filter(Boolean);

  if (key === 'has' || key === 'with') {
    const flags = values.map((v) => FLAG_ALIASES[v.replace(/[^a-z0-9]/g, '')]).filter(Boolean) as FlagKey[];
    if (!flags.length) return false;
    (negate ? q.missing : q.has).push(...flags);
    for (const f of flags) q.chips.push({ label: `${negate ? 'no' : 'has'} ${f}`, kind: 'flag' });
    return true;
  }
  if (key === 'no' || key === 'missing' || key === 'without' || key === 'needs') {
    const flags = values.map((v) => FLAG_ALIASES[v.replace(/[^a-z0-9]/g, '')]).filter(Boolean) as FlagKey[];
    if (!flags.length) return false;
    (negate ? q.has : q.missing).push(...flags);
    for (const f of flags) q.chips.push({ label: `${negate ? 'has' : 'no'} ${f}`, kind: 'flag' });
    return true;
  }
  if (key === 'tier') {
    // `tier:a`, `tier:ab`, `tier:a,b`
    const letters = value.replace(/[^abcd]/gi, '').toUpperCase().split('');
    const tiers = letters.map((l) => normalizeTier(l)).filter(Boolean) as Tier[];
    if (!tiers.length) return false;
    (negate ? q.notTiers : q.tiers).push(...tiers);
    for (const t of tiers) {
      q.chips.push({ label: `${negate ? 'not ' : ''}Tier ${t}`, kind: negate ? 'exclude' : 'tier' });
    }
    return true;
  }
  if (key === 'status' || key === 'stage') {
    const statuses = values
      .map((v) => (v === 'uncontacted' || v === 'none' ? 'new' : v))
      .filter((v): v is CustomerStatus => (CUSTOMER_STATUSES as string[]).includes(v));
    if (!statuses.length) return false;
    (negate ? q.notStatuses : q.statuses).push(...statuses);
    for (const s of statuses) {
      q.chips.push({ label: `${negate ? 'not ' : ''}${s}`, kind: negate ? 'exclude' : 'status' });
    }
    return true;
  }

  const field = FIELD_ALIASES[key];
  if (!field) return false;
  q.terms.push({ field, text: value, negate });
  q.chips.push({ label: `${negate ? 'not ' : ''}${key}: ${value}`, kind: negate ? 'exclude' : 'field' });
  return true;
}

// --- Matching ---------------------------------------------------------------

const low = (v: string | null | undefined) => (v ?? '').toLowerCase();

/** Everything about a row that a bare word should be able to find. */
function haystack(row: CustomerRecord, field: SearchField): string {
  switch (field) {
    case 'state': {
      const abbr = stateAbbr(row.state);
      return low(`${row.state ?? ''} ${abbr} ${abbr ? STATE_NAMES[abbr] : ''}`);
    }
    case 'school': return low(row.school);
    case 'conference': return low(row.conference);
    case 'division': return low(`${row.division ?? ''} ${DIVISION_LABELS[divisionKey(row.division)]}`);
    case 'connection': return low(`${row.firstDegreeConn ?? ''} ${row.firstDegreeNotes ?? ''}`);
    case 'instagram': return low(row.instagram);
    case 'email': return low(row.email);
    case 'coach': return low(row.coachName);
    case 'phone': return low(row.phone);
    case 'notes': return low(row.notes);
    case 'link': return low(`${row.rosterLink ?? ''} ${row.website ?? ''}`);
    default:
      return [
        haystack(row, 'school'), haystack(row, 'state'), haystack(row, 'conference'),
        haystack(row, 'division'), haystack(row, 'connection'), haystack(row, 'instagram'),
        haystack(row, 'email'), haystack(row, 'coach'), haystack(row, 'phone'),
        haystack(row, 'notes'), haystack(row, 'link'),
      ].join(' ');
  }
}

function flagValue(row: CustomerRecord, flag: FlagKey): boolean {
  const t = (v: string | null) => Boolean((v ?? '').trim());
  switch (flag) {
    case 'email': return t(row.email);
    case 'phone': return t(row.phone);
    case 'coach': return t(row.coachName);
    case 'instagram': return t(row.instagram);
    case 'roster': return t(row.rosterLink);
    case 'website': return t(row.website);
    case 'notes': return t(row.notes);
    case 'connection': return hasWarmConnection(row);
    case 'contact': return t(row.email) || t(row.phone) || t(row.instagram);
  }
}

export function matchesQuery(item: ScoredCustomer, q: ParsedQuery): boolean {
  const { row } = item;
  const status = statusOf(row);
  if (q.tiers.length && !q.tiers.includes(item.tier.tier)) return false;
  if (q.notTiers.includes(item.tier.tier)) return false;
  if (q.statuses.length && !q.statuses.includes(status)) return false;
  if (q.notStatuses.includes(status)) return false;
  for (const f of q.has) if (!flagValue(row, f)) return false;
  for (const f of q.missing) if (flagValue(row, f)) return false;
  for (const term of q.terms) {
    const hit = haystack(row, term.field).includes(term.text);
    if (term.negate ? hit : !hit) return false;
  }
  return true;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * How well a row matches the words typed. A hit on the school name outweighs
 * the tier score by design: typing "moravian" should surface Moravian, while an
 * open-ended search ("pa", "d3") falls back to tier order.
 */
export function relevanceOf(row: CustomerRecord, q: ParsedQuery): number {
  let rel = 0;
  const school = low(row.school);
  for (const term of q.terms) {
    if (term.negate) continue;
    const t = term.text;
    if (school && school === t) rel += 100;
    else if (school && school.startsWith(t)) rel += 70;
    else if (school && new RegExp(`\\b${escapeRe(t)}`).test(school)) rel += 45;
    else if (school && school.includes(t)) rel += 25;
    else rel += 2; // matched some other column
  }
  return rel;
}

/** How hard relevance pushes against the tier score (max 100) when ranking. */
const RELEVANCE_WEIGHT = 6;

// --- Sorting ----------------------------------------------------------------

export type SortKey = 'best' | 'tier' | 'school' | 'state' | 'updated';

export const SORT_LABELS: Record<SortKey, string> = {
  best: 'Best match',
  tier: 'Tier (most likely first)',
  school: 'School A–Z',
  state: 'State',
  updated: 'Recently updated',
};

export interface RankedCustomer extends ScoredCustomer {
  relevance: number;
  rank: number;
}

const byText = (a: string | null, b: string | null) =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });

/** Filter to the query, then order for the chosen sort. */
export function searchCustomers(
  items: ScoredCustomer[],
  q: ParsedQuery,
  sort: SortKey = 'best',
): RankedCustomer[] {
  const out: RankedCustomer[] = [];
  for (const item of items) {
    if (!matchesQuery(item, q)) continue;
    const relevance = q.terms.length ? relevanceOf(item.row, q) : 0;
    out.push({ ...item, relevance, rank: item.tier.rankScore + relevance * RELEVANCE_WEIGHT });
  }

  out.sort((a, b) => {
    switch (sort) {
      case 'school': return byText(a.row.school, b.row.school);
      case 'state': return byText(a.row.state, b.row.state) || byText(a.row.school, b.row.school);
      case 'updated': return (b.row.updatedAt ?? '').localeCompare(a.row.updatedAt ?? '');
      case 'tier': return b.tier.rankScore - a.tier.rankScore || byText(a.row.school, b.row.school);
      default: return b.rank - a.rank || byText(a.row.school, b.row.school);
    }
  });
  return out;
}

/** How many rows a canned query would return (for the quick-filter chips). */
export function countFor(items: ScoredCustomer[], query: string): number {
  const q = parseQuery(query);
  let n = 0;
  for (const item of items) if (matchesQuery(item, q)) n++;
  return n;
}
