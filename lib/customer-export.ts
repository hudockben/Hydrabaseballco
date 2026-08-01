// CSV export for the Customer List. Shared by the browser ("export what I'm
// looking at, in the order I'm looking at it") and the API's full dump, so a
// downloaded call sheet always carries the tier and the next action with it.

import { STATUS_LABELS, statusOf } from './customers';
import type { ScoredCustomer } from './customer-tiers';

const COLUMNS: Array<[string, (item: ScoredCustomer) => unknown]> = [
  ['Tier', (i) => i.tier.tier],
  ['Score', (i) => i.tier.score],
  ['Next action', (i) => i.tier.nextAction],
  ['Why', (i) => i.tier.signals.filter((s) => s.points > 0).map((s) => s.label).join('; ')],
  ['State', (i) => i.row.state],
  ['School', (i) => i.row.school],
  ['Conference', (i) => i.row.conference],
  ['Division', (i) => i.row.division],
  ['Coach / Contact', (i) => i.row.coachName],
  ['Email', (i) => i.row.email],
  ['Phone', (i) => i.row.phone],
  ['Instagram', (i) => i.row.instagram],
  ['Status', (i) => STATUS_LABELS[statusOf(i.row)]],
  ['Last contacted', (i) => (i.row.lastContacted ? i.row.lastContacted.slice(0, 10) : '')],
  ['1st Degree Conn', (i) => i.row.firstDegreeConn],
  ['1st Degree Notes', (i) => i.row.firstDegreeNotes],
  ['2026 Roster Link', (i) => i.row.rosterLink],
  ['Website', (i) => i.row.website],
  ['Notes', (i) => i.row.notes],
];

function esc(v: unknown): string {
  const str = v == null ? '' : String(v);
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

export function customerCsv(items: ScoredCustomer[]): string {
  const header = COLUMNS.map(([label]) => label).join(',');
  const lines = items.map((item) => COLUMNS.map(([, get]) => esc(get(item))).join(','));
  return [header, ...lines].join('\n');
}

/** Filename with a date stamp: hydra-customers-2026-08-01.csv */
export function csvFilename(prefix = 'hydra-customers'): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
