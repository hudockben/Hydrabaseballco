// Shared Customer List types, constants, and small helpers.
//
// The Customer List is the recruiting sheet of school baseball programs we sell
// to. `lib/customer-tiers.ts` scores these rows, `lib/customer-search.ts`
// searches them, and `lib/customer-outreach.ts` drafts the reach-out email.

export interface CustomerRecord {
  id: number;
  state: string | null;
  school: string | null;
  conference: string | null;
  rosterLink: string | null;
  division: string | null;
  firstDegreeConn: string | null;
  firstDegreeNotes: string | null;
  instagram: string | null;
  email: string | null;
  notes: string | null;
  // Added with the reach-out queue (see db/migrations/2026-08-01-*).
  coachName: string | null;
  phone: string | null;
  website: string | null;
  status: string | null;
  tierOverride: string | null;
  lastContacted: string | null;
  enrichedAt: string | null;
  updatedAt: string | null;
}

export type CustomerStatus = 'new' | 'contacted' | 'replied' | 'interested' | 'customer' | 'passed';

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'new', 'contacted', 'replied', 'interested', 'customer', 'passed',
];

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  new: 'Not contacted',
  contacted: 'Contacted',
  replied: 'Replied',
  interested: 'Interested',
  customer: 'Customer',
  passed: 'Passed',
};

/** Rows written before the status column existed read as `new`. */
export function statusOf(row: Pick<CustomerRecord, 'status'>): CustomerStatus {
  const s = (row.status ?? '').trim().toLowerCase();
  return (CUSTOMER_STATUSES as string[]).includes(s) ? (s as CustomerStatus) : 'new';
}

export const DIVISIONS = ['NCAA D1', 'NCAA D2', 'NCAA D3', 'NAIA', 'NJCAA D1', 'NJCAA D2', 'NJCAA D3'];

// ---------------------------------------------------------------------------
// States — the sheet mixes "PA" and "Pennsylvania"; everything normalizes to
// the two-letter code so search and proximity scoring agree.
// ---------------------------------------------------------------------------

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const NAME_TO_ABBR = new Map<string, string>(
  Object.entries(STATE_NAMES).map(([abbr, name]) => [name.toLowerCase(), abbr]),
);

/** "pennsylvania" / "Pa." / "PA" -> "PA". Returns '' when unrecognized. */
export function stateAbbr(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  const up = t.replace(/\./g, '').toUpperCase();
  if (up.length === 2 && STATE_NAMES[up]) return up;
  return NAME_TO_ABBR.get(t.toLowerCase().replace(/\s+/g, ' ')) ?? '';
}

/** Bordering states — a coach two hours down the road is an easier first sale. */
const ADJACENT: Record<string, string> = {
  AL: 'FL GA MS TN', AK: '', AZ: 'CA CO NM NV UT', AR: 'LA MS MO OK TN TX',
  CA: 'AZ NV OR', CO: 'AZ KS NE NM OK UT WY', CT: 'MA NY RI', DE: 'MD NJ PA',
  DC: 'MD VA', FL: 'AL GA', GA: 'AL FL NC SC TN', HI: '', ID: 'MT NV OR UT WA WY',
  IL: 'IN IA KY MO WI', IN: 'IL KY MI OH', IA: 'IL MN MO NE SD WI',
  KS: 'CO MO NE OK', KY: 'IL IN MO OH TN VA WV', LA: 'AR MS TX', ME: 'NH',
  MD: 'DC DE PA VA WV', MA: 'CT NH NY RI VT', MI: 'IN OH WI', MN: 'IA ND SD WI',
  MS: 'AL AR LA TN', MO: 'AR IL IA KS KY NE OK TN', MT: 'ID ND SD WY',
  NE: 'CO IA KS MO SD WY', NV: 'AZ CA ID OR UT', NH: 'MA ME VT', NJ: 'DE NY PA',
  NM: 'AZ CO OK TX UT', NY: 'CT MA NJ PA VT', NC: 'GA SC TN VA', ND: 'MN MT SD',
  OH: 'IN KY MI PA WV', OK: 'AR CO KS MO NM TX', OR: 'CA ID NV WA',
  PA: 'DE MD NJ NY OH WV', RI: 'CT MA', SC: 'GA NC', SD: 'IA MN MT NE ND WY',
  TN: 'AL AR GA KY MO MS NC VA', TX: 'AR LA NM OK', UT: 'AZ CO ID NM NV WY',
  VT: 'MA NH NY', VA: 'DC KY MD NC TN WV', WA: 'ID OR', WV: 'KY MD OH PA VA',
  WI: 'IA IL MI MN', WY: 'CO ID MT NE SD UT',
};

export function isAdjacentState(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  return (ADJACENT[a] ?? '').split(' ').includes(b);
}

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------

export type DivisionKey = 'd1' | 'd2' | 'd3' | 'naia' | 'juco' | 'other';

export const DIVISION_LABELS: Record<DivisionKey, string> = {
  d1: 'NCAA D1', d2: 'NCAA D2', d3: 'NCAA D3', naia: 'NAIA', juco: 'JUCO', other: 'Unlisted',
};

/** "NCAA D-III", "DIII", "njcaa d2", "NAIA" -> a comparable key. */
export function divisionKey(raw: string | null | undefined): DivisionKey {
  const t = (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t) return 'other';
  if (t.includes('naia')) return 'naia';
  if (/njcaa|juco|cccaa|nwac|jucos|communitycollege/.test(t)) return 'juco';
  const m = t.match(/d(?:iv(?:ision)?)?(iii|ii|i|3|2|1)(?![0-9])/);
  const level = m?.[1];
  if (level === 'iii' || level === '3') return 'd3';
  if (level === 'ii' || level === '2') return 'd2';
  if (level === 'i' || level === '1') return 'd1';
  return 'other';
}

// ---------------------------------------------------------------------------
// Link helpers
// ---------------------------------------------------------------------------

export function externalUrl(value: string): string {
  return /^https?:/i.test(value) ? value : `https://${value}`;
}

export function instagramUrl(value: string): string {
  const v = value.trim();
  if (/^https?:/i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, '')}`;
}

// ---------------------------------------------------------------------------
// 1st-degree connections
// ---------------------------------------------------------------------------

/** What people type in the connection column when there is nobody. */
const NO_CONNECTION = new Set([
  'no', 'none', 'nobody', 'no one', 'noone', 'not yet', 'none yet', 'no one yet',
  'no connection', 'na', 'n/a', 'tbd', 'unknown', 'x', '0',
]);

/**
 * Is there a real connection on this row? Shared by the tier scoring and the
 * `has:connection` search filter so the two can never disagree.
 */
export function hasWarmConnection(row: Pick<CustomerRecord, 'firstDegreeConn'>): boolean {
  const v = (row.firstDegreeConn ?? '').trim().toLowerCase().replace(/[.!]+$/, '');
  if (!v) return false;
  if (NO_CONNECTION.has(v)) return false;
  return !/^[-—–?.\s]+$/.test(v); // dashes, question marks, punctuation only
}
