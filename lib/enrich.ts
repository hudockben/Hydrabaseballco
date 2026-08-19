// Contact enrichment: given an org's website, fetch the homepage (and a
// linked "contact" page if needed) and pull a public email + phone number.
// Free, no API keys. Polite: one or two requests, short timeouts, real UA.

const UA = 'HydraProspector/1.0 (+https://hydrabaseballco.vercel.app)';
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Valid US/NANP numbers: area code and exchange start 2-9 (rejects junk like "084").
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}/g;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(6500),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !ct.includes('text') && !ct.includes('html')) return null;
    return (await res.text()).slice(0, 600_000);
  } catch {
    return null;
  }
}

function pickEmail(html: string): string | null {
  const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]));
  const candidates = mailtos.length ? mailtos : html.match(EMAIL_RE) ?? [];
  const cleaned = candidates
    .map((e) => e.trim().toLowerCase())
    .filter(
      (e) =>
        !/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(e) &&
        !/(example\.|sentry|wixpress|\.wix|@2x|@3x|godaddy|cloudflare)/i.test(e),
    );
  return cleaned[0] ?? null;
}

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return raw.trim();
}

function pickPhone(html: string): string | null {
  const tels = [...html.matchAll(/tel:([+\d().\-\s]{7,})/gi)].map((m) => m[1].trim());
  if (tels[0]) return normalizePhone(tels[0]);
  const text = html.replace(/<[^>]+>/g, ' ');
  const m = text.match(PHONE_RE);
  return m ? normalizePhone(m[0]) : null;
}

// Score links by how likely they lead to a coach/contact, so we can crawl
// homepage -> athletics -> baseball/softball -> coaches.
const LINK_SCORES: Array<[RegExp, number]> = [
  [/baseball/i, 6],
  [/softball/i, 6],
  [/coach/i, 5],
  [/coaching[\s_-]*staff|staff[\s_-]*directory/i, 5],
  [/staff[\s_-]*director|staff|roster|personnel/i, 4],
  [/equipment/i, 3],
  [/athletic/i, 3],
  [/contact/i, 2],
  [/about|team|directory|meet/i, 1],
];

function candidateLinks(html: string, base: string): string[] {
  const re = /<a[^>]+href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const scored: Array<{ url: string; score: number }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    const hay = `${href} ${text}`;
    let score = 0;
    for (const [rx, s] of LINK_SCORES) if (rx.test(hay)) score = Math.max(score, s);
    if (!score) continue;
    let url: string;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    scored.push({ url, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 5).map((x) => x.url);
}

// Best-effort: find a contact person's name near a coach/AD/director label.
const NAME = '([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)';
// Separator between a role and a name: optional punctuation, or at least one
// space. Lets us catch "Head Coach Mike Deegan" (no punctuation) as well as
// "Head Coach: Mike Deegan".
const SEP = '(?:\\s*[:\\-–|,]\\s*|\\s+)';
const COACH_ROLE =
  'head\\s+(?:baseball|softball)\\s+coach|head\\s+coach|(?:baseball|softball)\\s+coach|' +
  'associate\\s+head\\s+coach|assistant\\s+(?:baseball\\s+|softball\\s+)?coach|' +
  'pitching\\s+coach|hitting\\s+coach|recruiting\\s+coordinator';
const CONTACT_ROLE =
  'athletic\\s+director|director\\s+of\\s+athletics|director\\s+of\\s+baseball(?:\\s+operations)?|' +
  'general\\s+manager|program\\s+director|owner|president|founder';

// Words that are not first/last names — guards against "Our History",
// "Athletic Department", "Of The", etc. matching the name pattern.
const NAME_STOP = new Set([
  'the', 'of', 'our', 'your', 'their', 'about', 'home', 'news', 'welcome', 'history',
  'board', 'office', 'department', 'athletic', 'athletics', 'baseball', 'softball',
  'team', 'teams', 'staff', 'contact', 'privacy', 'policy', 'site', 'map', 'search',
  'menu', 'main', 'quick', 'links', 'read', 'more', 'view', 'all', 'meet', 'message',
  'page', 'college', 'university', 'school', 'high', 'academy', 'sports', 'sport',
  'season', 'schedule', 'roster', 'coaches', 'coach', 'director', 'president', 'owner',
  'manager', 'general', 'head', 'assistant', 'associate', 'program', 'camp', 'club',
  'league', 'center', 'centre', 'field', 'park', 'complex', 'information', 'directory',
  'for', 'vice', 'var', 'obj', 'and', 'function', 'return', 'enrollment', 'recreation',
  'services', 'admissions', 'apply', 'visit', 'info', 'request', 'health', 'human',
  // Page-chrome words that share the "Two Capitalized Words" shape (kept clear
  // of real surnames like Hall, Price, Field, Young, Long).
  'bio', 'biography', 'full', 'view', 'profile', 'email', 'phone', 'fax', 'hometown',
  'alumni', 'fame', 'named', 'gallery', 'video', 'faq', 'login', 'register',
  'registration', 'donate', 'tickets', 'ticket', 'calendar', 'directions',
  'statistics', 'featured', 'recent', 'latest', 'upcoming', 'complete', 'headlines',
]);

function cleanText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

function plausibleName(s: string): boolean {
  const parts = s.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((p) => {
    const w = p.replace(/[.,]/g, '').toLowerCase();
    return w.length < 2 || !NAME_STOP.has(w);
  });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Generic mailboxes that are not a person's name.
const GENERIC_LOCAL =
  /^(?:info|contact|admin|office|hello|hi|sales|support|webmaster|team|baseball|softball|athletic|athletics|coach|coaches|general|gm|mail|email|booking|register|registration|registrar|help|service|services|no-?reply|do-?not-?reply|inquiries|enquiries|main|front|desk|hr|jobs|careers|media|press)$/;

/** "mike.deegan@…" -> "Mike Deegan". Conservative: only first.last locals. */
function nameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0].toLowerCase();
  if (GENERIC_LOCAL.test(local)) return null;
  const m = local.match(/^([a-z]{2,})[._]([a-z]{2,})$/);
  if (m && !NAME_STOP.has(m[1]) && !NAME_STOP.has(m[2])) return `${cap(m[1])} ${cap(m[2])}`;
  return null;
}

/** An email link whose visible text is a person's name — high precision. */
function nameFromMailtoAnchor(html: string): string | null {
  const re = /<a[^>]+href\s*=\s*["']mailto:[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (plausibleName(text)) return text;
  }
  return null;
}

/** First match of `re` whose captured name passes the plausibility guard. */
function firstPlausibleMatch(re: RegExp, text: string): string | null {
  for (const m of text.matchAll(re)) {
    const name = m[1]?.replace(/\s+/g, ' ').trim();
    if (name && plausibleName(name)) return name;
  }
  return null;
}

function pickName(html: string): string | null {
  // 1) An email link whose anchor text is a name (most reliable).
  const mailtoName = nameFromMailtoAnchor(html);
  if (mailtoName) return mailtoName;

  // 2) Role + name in the page text. Punctuated forms first (highest
  //    confidence), then separator-optional forms; coach roles before generic
  //    contacts. matchAll lets a later valid match win when the first is junk.
  const text = cleanText(html);
  const patterns: RegExp[] = [
    new RegExp(`(?:${COACH_ROLE})\\s*[:\\-–|]\\s*${NAME}`, 'gi'),
    new RegExp(`${NAME}\\s*,\\s*(?:${COACH_ROLE})`, 'gi'),
    new RegExp(`(?:${COACH_ROLE})${SEP}${NAME}`, 'gi'),
    new RegExp(`${NAME}${SEP}(?:${COACH_ROLE})`, 'gi'),
    new RegExp(`(?:${CONTACT_ROLE})\\s*[:\\-–|]\\s*${NAME}`, 'gi'),
    new RegExp(`${NAME}\\s*,\\s*(?:${CONTACT_ROLE})`, 'gi'),
    new RegExp(`(?:${CONTACT_ROLE})${SEP}${NAME}`, 'gi'),
    new RegExp(`${NAME}${SEP}(?:${CONTACT_ROLE})`, 'gi'),
  ];
  for (const re of patterns) {
    const name = firstPlausibleMatch(re, text);
    if (name) return name;
  }
  return null;
}

export interface Contact {
  email: string | null;
  phone: string | null;
  contactName: string | null;
}

export async function findContact(website: string, deep = true): Promise<Contact> {
  const base = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const home = await fetchText(base);
  let email = home ? pickEmail(home) : null;
  let phone = home ? pickPhone(home) : null;
  let contactName = home ? pickName(home) : null;
  if (!home) return { email, phone, contactName };

  // deep: crawl homepage -> athletics -> baseball/softball -> coaches.
  // quick (deep=false): homepage + the single best contact page only — fast
  // enough to auto-run across many search results.
  const visited = new Set<string>([base]);
  let queue = candidateLinks(home, base).filter((u) => !visited.has(u));
  let budget = deep ? 4 : 1;

  while (queue.length && budget > 0 && !(contactName && email)) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    budget--;
    const page = await fetchText(url);
    if (!page) continue;
    email = email ?? pickEmail(page);
    phone = phone ?? pickPhone(page);
    contactName = contactName ?? pickName(page);
    if (deep && !contactName) {
      const deeper = candidateLinks(page, url).filter((u) => !visited.has(u));
      queue = [...deeper, ...queue];
    }
  }

  // Last resort: a personal-looking contact email implies the contact's name.
  if (!contactName) contactName = nameFromEmail(email);
  return { email, phone, contactName };
}

// ---------------------------------------------------------------------------
// Program contacts (Customer List)
//
// For a college program we want the person who actually orders balls — head
// coach first, then the rest of the staff — not whatever address happens to sit
// in the site footer. So instead of taking the first email on the page, every
// `mailto:` is scored by the job title printed next to it.
// ---------------------------------------------------------------------------

const ROLE_SCORES: Array<[RegExp, number, string]> = [
  [/head\s+(?:baseball|softball)\s+coach/i, 10, 'Head Coach'],
  [/(?:baseball|softball)\s+head\s+coach/i, 10, 'Head Coach'],
  [/head\s+coach/i, 9, 'Head Coach'],
  [/(?:associate|assistant)\s+head\s+coach/i, 8, 'Associate Head Coach'],
  [/recruiting\s+coordinator/i, 8, 'Recruiting Coordinator'],
  [/(?:baseball|softball)\s+coach/i, 8, 'Coach'],
  [/director\s+of\s+baseball(?:\s+operations)?/i, 7, 'Director of Baseball Ops'],
  [/assistant\s+coach|volunteer\s+coach/i, 7, 'Assistant Coach'],
  [/pitching\s+coach|hitting\s+coach|bench\s+coach/i, 6, 'Coach'],
  [/equipment\s+manager|director\s+of\s+equipment|equipment\s+operations/i, 5, 'Equipment Manager'],
  [/athletic\s+director|director\s+of\s+athletics/i, 4, 'Athletic Director'],
  [/head\s+athletic\s+trainer|operations\s+manager/i, 2, 'Athletics Staff'],
];

export interface ProgramContact extends Contact {
  /** Job title we matched the contact on, e.g. "Head Coach". */
  role: string | null;
  /** Page the contact came off, so a wrong pick is easy to check. */
  sourceUrl: string | null;
}

interface StaffHit extends ProgramContact {
  score: number;
}

/** The job title printed nearest this point on the page, if any. */
function roleNear(text: string): { role: string; score: number } | null {
  let best: { role: string; score: number } | null = null;
  for (const [re, score, role] of ROLE_SCORES) {
    if (re.test(text) && (!best || score > best.score)) best = { role, score };
  }
  return best;
}

/** Anchor text of the mailto at `index`, when it reads like a person's name. */
function anchorNameAt(html: string, index: number): string | null {
  const open = html.lastIndexOf('<a', index);
  if (open === -1 || index - open > 400) return null;
  const close = html.indexOf('</a>', index);
  if (close === -1) return null;
  const gt = html.indexOf('>', index);
  if (gt === -1 || gt > close) return null;
  const text = html.slice(gt + 1, close).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return plausibleName(text) ? text : null;
}

/** Does this email address look like it belongs to `name`? */
function emailMatchesName(email: string, name: string): boolean {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  return parts.some((p) => local.includes(p));
}

/**
 * Every `mailto:` on the page, scored by the staff title printed around it.
 * A generic address (info@, athletics@) with no title still scores 0 and is
 * kept as a fallback — better than nothing when no staff page exists.
 */
function staffHits(html: string, url: string): StaffHit[] {
  const hits: StaffHit[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const index = m.index ?? 0;
    let email: string;
    try {
      email = decodeURIComponent(m[1]).trim().toLowerCase();
    } catch {
      email = m[1].trim().toLowerCase();
    }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) continue;
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(email)) continue;
    if (/(example\.|sentry|wixpress|\.wix|godaddy|cloudflare)/i.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    // Staff tables put the title just before the link; cards put it just after.
    const window = cleanText(html.slice(Math.max(0, index - 1500), index + 700));
    const near = roleNear(window);
    const name = anchorNameAt(html, index) ?? nameFromEmail(email) ?? namePreceding(window);
    let score = near?.score ?? 0;
    if (name) score += 2;
    if (name && emailMatchesName(email, name)) score += 2;
    if (GENERIC_LOCAL.test(email.split('@')[0])) score -= 1;
    hits.push({ email, phone: null, contactName: name, role: near?.role ?? null, sourceUrl: url, score });
  }
  return hits;
}

/** Last plausible "First Last" in a chunk of text — the person a title belongs to. */
function namePreceding(text: string): string | null {
  const re = new RegExp(NAME, 'g');
  let found: string | null = null;
  for (const m of text.matchAll(re)) {
    const candidate = m[1]?.replace(/\s+/g, ' ').trim();
    if (candidate && plausibleName(candidate)) found = candidate;
  }
  return found;
}

/**
 * Find the person to email at a school's baseball program.
 *
 * Starts from the roster link (or the athletics site), follows links toward the
 * coaching staff / staff directory, and returns the highest-scoring staff
 * contact it can find. Budgeted so a single lookup can't run long.
 */
export async function findProgramContact(opts: {
  rosterLink?: string | null;
  website?: string | null;
  budget?: number;
}): Promise<ProgramContact> {
  const empty: ProgramContact = { email: null, phone: null, contactName: null, role: null, sourceUrl: null };
  const seeds: string[] = [];
  const push = (u: string | null | undefined) => {
    const raw = (u ?? '').trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!seeds.includes(url)) seeds.push(url);
  };
  push(opts.rosterLink);
  push(opts.website);
  // The athletics site root, in case the roster URL itself 404s.
  for (const seed of [...seeds]) {
    try {
      push(new URL(seed).origin);
    } catch {
      /* not a URL — skip */
    }
  }
  if (!seeds.length) return empty;

  let budget = Math.max(1, Math.min(opts.budget ?? 5, 8));
  const visited = new Set<string>();
  const queue = [...seeds];
  const hits: StaffHit[] = [];
  let phone: string | null = null;
  // Plain-text fallbacks, in case the site prints contacts without mailto links.
  let textEmail: string | null = null;
  let textName: string | null = null;
  let lastFetched: string | null = null;

  while (queue.length && budget > 0) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    budget--;
    const page = await fetchText(url);
    if (!page) continue;
    lastFetched = url;

    hits.push(...staffHits(page, url));
    phone = phone ?? pickPhone(page);
    textEmail = textEmail ?? pickEmail(page);
    textName = textName ?? pickName(page);

    // A named coach with an address is as good as it gets — stop early.
    if (hits.some((h) => h.score >= 10)) break;
    for (const link of candidateLinks(page, url)) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }
  }

  if (!hits.length) {
    // No mailto anywhere — hand back whatever the plain-text scrape turned up.
    return {
      email: textEmail,
      phone,
      contactName: textName ?? nameFromEmail(textEmail),
      role: null,
      sourceUrl: lastFetched,
    };
  }

  hits.sort((a, b) => b.score - a.score);
  const best = hits[0];
  return {
    email: best.email,
    phone: best.phone ?? phone,
    // A generic mailbox (info@, athletics@) carries no name — if the page named
    // a coach in plain text, keep that.
    contactName: best.contactName ?? textName,
    role: best.role,
    sourceUrl: best.sourceUrl,
  };
}
