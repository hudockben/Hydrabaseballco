'use client';

import { useState } from 'react';
import {
  CUSTOMER_STATUSES,
  STATUS_LABELS,
  externalUrl,
  instagramUrl,
  statusOf,
  type CustomerRecord,
} from '@/lib/customers';
import { TIER_META } from '@/lib/customer-tiers';
import type { RankedCustomer } from '@/lib/customer-search';
import { outreachDraft } from '@/lib/customer-outreach';

interface Props {
  items: RankedCustomer[];
  startIndex: number;
  enriching: Record<number, boolean>;
  checked: Record<number, boolean>;
  onField: (row: CustomerRecord, key: string, value: string) => void;
  onPatch: (id: number, changes: Record<string, unknown>) => void;
  onEnrich: (row: CustomerRecord) => Promise<boolean>;
  onContacted: (row: CustomerRecord) => void;
}

/** "Email on file +18, D3 +14, …" — the whole reason a school is where it is. */
function whyText(item: RankedCustomer): string {
  const lines = item.tier.signals.map((s) => `${s.points > 0 ? '+' : ''}${s.points}  ${s.label}`);
  return [`${TIER_META[item.tier.tier].label} · score ${item.tier.score}/100`, ...lines].join('\n');
}

export default function CustomerQueue({
  items, startIndex, enriching, checked, onField, onPatch, onEnrich, onContacted,
}: Props) {
  const [copied, setCopied] = useState<number | null>(null);

  async function copyDraft(row: CustomerRecord) {
    const { subject, body } = outreachDraft(row);
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(row.id);
      setTimeout(() => setCopied((c) => (c === row.id ? null : c)), 1800);
    } catch {
      /* clipboard blocked — the mailto button still works */
    }
  }

  return (
    <div className="cl-queue">
      {items.map((item, i) => {
        const row = item.row;
        const tier = item.tier;
        const status = statusOf(row);
        const draft = outreachDraft(row);
        const busy = enriching[row.id];
        const meta = [row.division, row.conference, row.state].filter(Boolean).join(' · ');
        const positives = tier.signals.filter((s) => s.points > 0).slice(0, 3);
        const negatives = tier.signals.filter((s) => s.points < 0);

        return (
          <article key={row.id} className={`cl-card cl-card--${status}`}>
            <div className="cl-card-rail">
              <span className="cl-rank">#{startIndex + i + 1}</span>
              <span
                className={`tier-badge tier-${tier.tier.toLowerCase()}`}
                title={whyText(item)}
              >
                {tier.tier}
              </span>
              <span className="cl-score" title={whyText(item)}>{tier.score}</span>
              {tier.overridden && <span className="cl-pin" title="Tier set by hand">pinned</span>}
            </div>

            <div className="cl-card-body">
              <div className="cl-card-head">
                <h3 className="cl-school">{row.school || <span className="muted">Untitled school</span>}</h3>
                {meta && <span className="muted cl-meta">{meta}</span>}
                <span className="cl-spacer" />
                <span className="cl-next">{tier.nextAction}</span>
              </div>

              <div className="cl-why">
                {positives.map((s) => (
                  <span key={s.label} className="cl-signal">{s.label}</span>
                ))}
                {negatives.map((s) => (
                  <span key={s.label} className="cl-signal neg">{s.label}</span>
                ))}
                {row.firstDegreeConn && (
                  <span className="cl-signal warm" title={row.firstDegreeNotes ?? undefined}>
                    via {row.firstDegreeConn}
                  </span>
                )}
              </div>

              <div className="cl-contact">
                <label className="cl-field">
                  <span>Coach</span>
                  <input
                    key={`coach-${row.coachName ?? ''}`}
                    className="cl-input"
                    defaultValue={row.coachName ?? ''}
                    placeholder={busy ? 'looking…' : 'name'}
                    onBlur={(e) => onField(row, 'coachName', e.target.value)}
                  />
                </label>
                <label className="cl-field wide">
                  <span>Email</span>
                  <input
                    key={`email-${row.email ?? ''}`}
                    className="cl-input"
                    defaultValue={row.email ?? ''}
                    placeholder={busy ? 'looking…' : 'coach@school.edu'}
                    onBlur={(e) => onField(row, 'email', e.target.value)}
                  />
                </label>
                <label className="cl-field">
                  <span>Phone</span>
                  <input
                    key={`phone-${row.phone ?? ''}`}
                    className="cl-input"
                    defaultValue={row.phone ?? ''}
                    placeholder={busy ? 'looking…' : '(555) 555-5555'}
                    onBlur={(e) => onField(row, 'phone', e.target.value)}
                  />
                </label>
                <div className="cl-links">
                  {row.instagram && (
                    <a href={instagramUrl(row.instagram)} target="_blank" rel="noreferrer">Instagram</a>
                  )}
                  {row.rosterLink && (
                    <a href={externalUrl(row.rosterLink)} target="_blank" rel="noreferrer">Roster</a>
                  )}
                  {row.website && (
                    <a href={externalUrl(row.website)} target="_blank" rel="noreferrer">Site</a>
                  )}
                  {!row.email && !row.phone && (checked[row.id] || row.enrichedAt) && (
                    <span className="muted">no contact found — try the roster link</span>
                  )}
                </div>
              </div>

              <div className="cl-card-actions">
                {draft.mailto ? (
                  <a
                    className="solid-btn cl-email-btn"
                    href={draft.mailto}
                    onClick={() => onContacted(row)}
                    title={draft.subject}
                  >
                    {status === 'new' ? 'Email draft' : 'Follow-up draft'}
                  </a>
                ) : (
                  <button
                    className="solid-btn cl-email-btn"
                    onClick={() => onEnrich(row)}
                    disabled={busy}
                  >
                    {busy ? 'Looking…' : 'Find contact'}
                  </button>
                )}
                <button className="ghost-btn" onClick={() => copyDraft(row)}>
                  {copied === row.id ? 'Copied' : 'Copy draft'}
                </button>
                {draft.mailto && (
                  <button className="mini-btn" onClick={() => onEnrich(row)} disabled={busy}>
                    {busy ? 'Looking…' : 'Re-check contact'}
                  </button>
                )}
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
                {row.lastContacted && (
                  <span className="muted cl-when">
                    last touch {new Date(row.lastContacted).toLocaleDateString()}
                  </span>
                )}
                <span className="cl-spacer" />
                <input
                  key={`notes-${row.notes ?? ''}`}
                  className="cl-input cl-note"
                  defaultValue={row.notes ?? ''}
                  placeholder="Add a note…"
                  onBlur={(e) => onField(row, 'notes', e.target.value)}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
