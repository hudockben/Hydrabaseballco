'use client';

import {
  CUSTOMER_STATUSES,
  DIVISIONS,
  STATUS_LABELS,
  externalUrl,
  instagramUrl,
  statusOf,
  type CustomerRecord,
} from '@/lib/customers';
import { TIERS, TIER_META } from '@/lib/customer-tiers';
import type { RankedCustomer } from '@/lib/customer-search';

type FieldKey =
  | 'state' | 'school' | 'conference' | 'rosterLink' | 'division' | 'firstDegreeConn'
  | 'firstDegreeNotes' | 'instagram' | 'email' | 'coachName' | 'phone' | 'website' | 'notes';

const COLUMNS: { key: FieldKey; label: string; type?: 'link' | 'instagram' | 'email'; wide?: boolean }[] = [
  { key: 'state', label: 'State' },
  { key: 'school', label: 'School', wide: true },
  { key: 'conference', label: 'Conference' },
  { key: 'rosterLink', label: '2026 Roster Link', type: 'link', wide: true },
  { key: 'division', label: 'Division' },
  { key: 'firstDegreeConn', label: '1st Degree Conn' },
  { key: 'firstDegreeNotes', label: '1st Degree Notes', wide: true },
  { key: 'coachName', label: 'Coach / Contact' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'instagram', label: 'Instagram', type: 'instagram' },
  { key: 'website', label: 'Website', type: 'link' },
  { key: 'notes', label: 'Notes', wide: true },
];

function hrefFor(type: 'link' | 'instagram' | 'email' | undefined, value: string): string | null {
  if (!type) return null;
  if (type === 'email') return `mailto:${value}`;
  if (type === 'instagram') return instagramUrl(value);
  return externalUrl(value);
}

interface Props {
  items: RankedCustomer[];
  enriching: Record<number, boolean>;
  onField: (row: CustomerRecord, key: string, value: string) => void;
  onPatch: (id: number, changes: Record<string, unknown>) => void;
  onEnrich: (row: CustomerRecord) => Promise<boolean>;
  onDelete: (id: number) => void;
}

/** The full recruiting sheet — every column, inline editable, tier-first. */
export default function CustomerSheet({ items, enriching, onField, onPatch, onEnrich, onDelete }: Props) {
  return (
    <>
      <datalist id="cl-divisions">
        {DIVISIONS.map((d) => <option key={d} value={d} />)}
      </datalist>

      <div className="table-wrap">
        <table className="data-table customer-table">
          <thead>
            <tr>
              <th title="Computed tier — pick a letter to pin it">Tier</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.wide ? 'wide' : undefined}>{c.label}</th>
              ))}
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ row, tier }) => {
              const status = statusOf(row);
              const why = [
                `${TIER_META[tier.tier].label} · score ${tier.score}/100`,
                ...tier.signals.map((s) => `${s.points > 0 ? '+' : ''}${s.points}  ${s.label}`),
              ].join('\n');
              return (
                <tr key={row.id}>
                  <td>
                    <div className="cl-cell">
                      <span className={`tier-badge tier-${tier.tier.toLowerCase()}`} title={why}>
                        {tier.tier}
                      </span>
                      <select
                        className="cl-tier-select"
                        value={tier.overridden ? tier.tier : ''}
                        onChange={(e) => onPatch(row.id, { tierOverride: e.target.value })}
                        title="Pin this school to a tier"
                        aria-label="Tier override"
                      >
                        <option value="">auto</option>
                        {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </td>
                  {COLUMNS.map((c) => {
                    const val = row[c.key] ?? '';
                    const href = val ? hrefFor(c.type, val) : null;
                    return (
                      <td key={c.key} className={c.wide ? 'wide' : undefined}>
                        <div className="cl-cell">
                          <input
                            key={`${c.key}-${val}`}
                            className="cl-input"
                            defaultValue={val}
                            placeholder={enriching[row.id] && !val ? 'looking…' : undefined}
                            list={c.key === 'division' ? 'cl-divisions' : undefined}
                            onBlur={(e) => onField(row, c.key, e.target.value)}
                          />
                          {href && (
                            <a className="cl-ext" href={href} target="_blank" rel="noreferrer" title="Open">↗</a>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <select
                      className={`status status-${status}`}
                      value={status}
                      onChange={(e) => onPatch(row.id, {
                        status: e.target.value,
                        markContacted: e.target.value === 'contacted',
                      })}
                      aria-label="Status"
                    >
                      {CUSTOMER_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="mini-btn"
                        onClick={() => onEnrich(row)}
                        disabled={enriching[row.id]}
                        title="Look up the coach, email, and phone from the roster link"
                      >
                        {enriching[row.id] ? '…' : 'find'}
                      </button>
                      <button className="link-danger" aria-label="Delete row" onClick={() => onDelete(row.id)}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
