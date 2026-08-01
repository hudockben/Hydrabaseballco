// Tiering for the Customer List: score every school on how likely it is to buy,
// so the list reads top-to-bottom as a reach-out queue (Tier A first).
//
// Scoring is deliberately explainable — every point comes from a labelled
// signal, and the UI shows the signals behind a row's tier. Pure functions, no
// I/O, so the client re-tiers instantly as rows are edited or enriched.

import {
  divisionKey,
  isAdjacentState,
  stateAbbr,
  statusOf,
  type CustomerRecord,
  type CustomerStatus,
  type DivisionKey,
} from './customers';

export type Tier = 'A' | 'B' | 'C' | 'D';

export const TIERS: Tier[] = ['A', 'B', 'C', 'D'];

export const TIER_META: Record<Tier, { label: string; blurb: string }> = {
  A: { label: 'Tier A', blurb: 'Warm and reachable — contact these first' },
  B: { label: 'Tier B', blurb: 'Good fit, reachable — solid outreach targets' },
  C: { label: 'Tier C', blurb: 'Plausible fit — needs a contact or a hook' },
  D: { label: 'Tier D', blurb: 'Cold or incomplete — fill in contact info first' },
};

/** Score cut-offs, highest first. */
const TIER_CUTOFFS: Array<[Tier, number]> = [['A', 58], ['B', 40], ['C', 24], ['D', -Infinity]];

/** Where a hand-pinned row sorts: inside its band, not at the band's edge. */
const TIER_SORT_FLOOR: Record<Tier, number> = { A: 70, B: 48, C: 30, D: 10 };

export interface TierSignal {
  label: string;
  points: number;
}

export interface TierResult {
  score: number;
  /** Score to sort by — a hand-pinned tier sorts inside its own band. */
  rankScore: number;
  tier: Tier;
  signals: TierSignal[];
  /** Can we actually contact them today? */
  reachable: boolean;
  /** Set by hand in the Tier column; beats the computed tier. */
  overridden: boolean;
  /** The one thing to do next for this school. */
  nextAction: string;
}

// --- Text signals -----------------------------------------------------------

/** Notes that say someone is moving toward buying. */
const BUYING_RE =
  /\b(interested|wants?|asked|asking|sample[sd]?|quote|order(?:ed|ing|s)?|buy(?:ing)?|purchas\w*|demo|meeting|zoom|follow ?-?up|ready|budget|trial|in talks|reached back|responded|replied|price list|pricing)\b/i;

/** Notes that say the door is closed — these fall to the bottom of the list. */
const PASSED_RE =
  /\b(not interested|no interest|declin\w+|pass(?:ed|ing)?\s+(?:on|for now)|no thanks|under contract|contract(?:ed)? with|exclusive with|locked in with|do ?n[o']?t contact|unsubscribe|no budget|not a fit|no need|all set|sticking with)\b/i;

/** A connection note that describes a real relationship, not just a name. */
const RELATIONSHIP_RE =
  /\b(played (?:with|for|against)|teammate|roommate|alum(?:ni|nus|na)?|friend|buddy|family|dad|father|mom|mother|brother|sister|cousin|uncle|nephew|coached|knows|know him|know her|met|classmate|trainer|travel ball|summer ball|high ?school coach|hs coach|former)\b/i;

/** Values people type in the connection column that mean "nobody". */
const NO_CONNECTION_RE = /^(no|none|n\/?a|-+|—|tbd|\?+|0|unknown)$/i;

// --- Fit weights ------------------------------------------------------------

// Who actually buys from a new ball brand: programs that purchase their own
// equipment. Most D1 baseball programs run on a national equipment contract,
// so they are the hardest first sale; D3 / NAIA / JUCO buy off their own budget.
const DIVISION_POINTS: Record<DivisionKey, { points: number; label: string }> = {
  d3: { points: 14, label: 'D3 — buys its own equipment' },
  naia: { points: 14, label: 'NAIA — buys its own equipment' },
  juco: { points: 13, label: 'JUCO — budget-driven buyer' },
  d2: { points: 11, label: 'D2 — often buys direct' },
  d1: { points: 5, label: 'D1 — usually on a national contract' },
  other: { points: 7, label: 'Division not listed' },
};

/** Most contact info a row can be worth, before fit / warmth signals. */
const REACH_CAP = 32;

const STATUS_POINTS: Record<CustomerStatus, { points: number; label: string }> = {
  interested: { points: 24, label: 'Said they are interested' },
  customer: { points: 20, label: 'Already a customer — reorder' },
  replied: { points: 16, label: 'Replied to outreach' },
  contacted: { points: 0, label: 'Already contacted' },
  new: { points: 0, label: '' },
  passed: { points: -60, label: 'Passed' },
};

export interface TierOptions {
  /** Two-letter home state; scores nearby programs higher. */
  homeState?: string | null;
}

const filled = (v: string | null | undefined): string => (v ?? '').trim();

/** Score one row 0–100 and explain every point of it. */
export function scoreCustomer(row: CustomerRecord, opts: TierOptions = {}): TierResult {
  const signals: TierSignal[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0 && label) signals.push({ label, points });
  };

  const conn = filled(row.firstDegreeConn);
  const connNotes = filled(row.firstDegreeNotes);
  const notes = filled(row.notes);
  const freeText = `${conn} ${connNotes} ${notes}`;
  const status = statusOf(row);

  // 1. A warm intro is the single biggest predictor of a first order.
  const hasConnection = Boolean(conn) && !NO_CONNECTION_RE.test(conn);
  if (hasConnection) {
    add('1st-degree connection', 30);
    if (connNotes) add('Connection details written down', 8);
    if (RELATIONSHIP_RE.test(`${conn} ${connNotes}`)) add('Personal tie (played/coached/knows)', 6);
  }

  // 2. What the notes say about intent.
  const passedInNotes = PASSED_RE.test(freeText);
  if (passedInNotes) add('Notes say they passed', -45);
  else if (BUYING_RE.test(freeText)) add('Buying signal in the notes', 16);

  // 3. Can we reach them? Capped at 32 so a fully-filled contact block alone
  //    never outranks a warm introduction.
  const reach: TierSignal[] = [];
  if (filled(row.email)) reach.push({ label: 'Email on file', points: 18 });
  if (filled(row.coachName)) reach.push({ label: 'Named coach / contact', points: 6 });
  if (filled(row.instagram)) reach.push({ label: 'Instagram (DM path)', points: 6 });
  if (filled(row.phone)) reach.push({ label: 'Phone number', points: 4 });
  if (filled(row.rosterLink) || filled(row.website)) reach.push({ label: 'Roster / program link', points: 4 });
  const reachTotal = reach.reduce((n, s) => n + s.points, 0);
  const reachScale = reachTotal > REACH_CAP ? REACH_CAP / reachTotal : 1;
  for (const s of reach) add(s.label, Math.round(s.points * reachScale));

  // 4. Program fit.
  const div = DIVISION_POINTS[divisionKey(row.division)];
  add(div.label, div.points);

  // 5. Proximity — easy to visit, easy to name-drop.
  const home = stateAbbr(opts.homeState);
  const st = stateAbbr(row.state);
  if (home && st) {
    if (home === st) add('In your home state', 8);
    else if (isAdjacentState(home, st)) add('Neighboring state', 4);
  }

  // 6. Where the conversation already stands.
  const stat = STATUS_POINTS[status];
  add(stat.label, stat.points);

  const raw = signals.reduce((n, s) => n + s.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  signals.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  const override = normalizeTier(row.tierOverride);
  const computed = status === 'passed' || passedInNotes ? 'D' : tierForScore(score);
  const tier = override ?? computed;

  return {
    score,
    // A pinned row sorts inside the band it was pinned to (keeping its own
    // score only as a tie-break), not where its raw signals would have put it.
    rankScore: override ? TIER_SORT_FLOOR[override] + score / 100 : score,
    tier,
    signals,
    reachable: Boolean(filled(row.email) || filled(row.phone) || filled(row.instagram)),
    overridden: override != null,
    nextAction: nextAction(row, status),
  };
}

export function tierForScore(score: number): Tier {
  for (const [tier, min] of TIER_CUTOFFS) if (score >= min) return tier;
  return 'D';
}

export function normalizeTier(raw: string | null | undefined): Tier | null {
  const t = (raw ?? '').trim().toUpperCase();
  return (TIERS as string[]).includes(t) ? (t as Tier) : null;
}

/** The single next step for this school, shown on the row. */
function nextAction(row: CustomerRecord, status: CustomerStatus): string {
  if (status === 'passed') return 'Passed — skip';
  if (status === 'customer') return 'Check in on a reorder';
  if (status === 'interested' || status === 'replied') return 'Send pricing / follow up';
  const email = filled(row.email);
  const coach = filled(row.coachName);
  if (status === 'contacted') return email ? 'Follow up by email' : 'Follow up';
  if (email) return coach ? `Email ${coach}` : 'Email the program';
  if (filled(row.phone)) return 'Call the program';
  if (filled(row.instagram)) return 'DM on Instagram';
  if (filled(row.rosterLink) || filled(row.website) || filled(row.school)) return 'Find contact info';
  return 'Add a roster link';
}

/** Score a whole list once — the page memoizes this and reuses it everywhere. */
export function scoreAll(rows: CustomerRecord[], opts: TierOptions = {}): ScoredCustomer[] {
  return rows.map((row) => ({ row, tier: scoreCustomer(row, opts) }));
}

export interface ScoredCustomer {
  row: CustomerRecord;
  tier: TierResult;
}
