'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CUSTOMER_FIELD_LABELS, parseImport } from '@/lib/customers-import';
import type { CustomerRecord } from '@/lib/customers';
import { scoreAll, TIERS, TIER_META, type Tier } from '@/lib/customer-tiers';
import {
  countFor,
  parseQuery,
  QUICK_SEARCHES,
  searchCustomers,
  SORT_LABELS,
  type SortKey,
} from '@/lib/customer-search';
import { csvFilename, customerCsv } from '@/lib/customer-export';
import CustomerQueue from './CustomerQueue';
import CustomerSheet from './CustomerSheet';

const PAGE_SIZE = 25;
const HOME_KEY = 'hydra-home-state';
const VIEW_KEY = 'hydra-customers-view';

/** PATCH keys that are instructions to the API, not columns on the row. */
const CONTROL_KEYS = ['markContacted', 'markEnriched'];

/** Rows we can look contact info up for, cheapest (has a link) first. */
function enrichTargets(rows: CustomerRecord[]): CustomerRecord[] {
  const missing = rows.filter(
    (r) => !r.email && !r.phone && !r.coachName && (r.rosterLink || r.website || r.school),
  );
  return [...missing].sort((a, b) => Number(Boolean(b.rosterLink || b.website)) - Number(Boolean(a.rosterLink || a.website)));
}

/** Add a search token, or take it back out if it's already there. */
function toggleToken(query: string, token: string): string {
  const tokens: string[] = query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const i = tokens.findIndex((t) => t.toLowerCase() === token.toLowerCase());
  if (i >= 0) tokens.splice(i, 1);
  else tokens.push(token);
  return tokens.join(' ');
}

export default function CustomerListPage() {
  const [rows, setRows] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('best');
  const [view, setView] = useState<'queue' | 'sheet'>('queue');
  const [homeState, setHomeState] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [page, setPage] = useState(1);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const [enriching, setEnriching] = useState<Record<number, boolean>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({}); // looked up, nothing found
  const [fill, setFill] = useState<{ done: number; total: number } | null>(null);
  const fillRun = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to load.');
        return;
      }
      setErr('');
      setRows(data.customers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Preferences live in the browser — no extra table for two settings.
  useEffect(() => {
    try {
      setHomeState(localStorage.getItem(HOME_KEY) ?? '');
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === 'sheet' || saved === 'queue') setView(saved);
    } catch {
      /* private mode — defaults are fine */
    }
  }, []);

  function chooseView(next: 'queue' | 'sheet') {
    setView(next);
    setPage(1);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function chooseHome(next: string) {
    setHomeState(next);
    try {
      localStorage.setItem(HOME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  // --- Tiering + search ------------------------------------------------------

  const scored = useMemo(() => scoreAll(rows, { homeState }), [rows, homeState]);
  const parsed = useMemo(() => parseQuery(query), [query]);
  const ranked = useMemo(() => searchCustomers(scored, parsed, sort), [scored, parsed, sort]);

  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const item of scored) counts[item.tier.tier]++;
    return counts;
  }, [scored]);

  const quickCounts = useMemo(
    () => QUICK_SEARCHES.map((q) => countFor(scored, q.query)),
    [scored],
  );

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = ranked.slice(start, start + PAGE_SIZE);

  const missingContact = useMemo(() => enrichTargets(ranked.map((r) => r.row)), [ranked]);
  const readyToEmail = ranked.filter((r) => r.row.email).length;

  function search(next: string) {
    setQuery(next);
    setPage(1);
  }

  // --- Row edits -------------------------------------------------------------

  const patch = useCallback(async (id: number, changes: Record<string, unknown>) => {
    const local = Object.fromEntries(
      Object.entries(changes).filter(([k]) => !CONTROL_KEYS.includes(k)),
    ) as Partial<CustomerRecord>;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...local } : r)));
    const res = await fetch('/api/admin/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...changes }),
    });
    if (!res.ok) {
      setMsg('That change did not save — refresh and try again.');
      return;
    }
    const data = await res.json().catch(() => null);
    if (data?.customer) setRows((rs) => rs.map((r) => (r.id === id ? data.customer : r)));
  }, []);

  const saveField = useCallback(
    (row: CustomerRecord, key: string, raw: string) => {
      const value = raw.trim();
      if (((row as unknown as Record<string, string | null>)[key] ?? '') === value) return;
      void patch(row.id, { [key]: value || null });
    },
    [patch],
  );

  /** Opening the draft counts as reaching out — stamp it so the queue moves on. */
  const markContacted = useCallback(
    (row: CustomerRecord) => {
      const status = row.status === 'new' || !row.status ? 'contacted' : row.status;
      void patch(row.id, { status, markContacted: true });
    },
    [patch],
  );

  async function addRow() {
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setRows((rs) => [data.customer, ...rs]);
      // A blank row scores at the bottom of the tier order, so jump to the view
      // and sort where it's actually visible.
      chooseView('sheet');
      setSort('updated');
      search('');
      setMsg('Blank row added — it’s at the top while sorted by recently updated.');
    } else setErr(data.error || 'Add failed.');
  }

  const remove = useCallback(async (id: number) => {
    if (!confirm('Delete this row?')) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await fetch(`/api/admin/customers?id=${id}`, { method: 'DELETE' });
  }, []);

  // --- Contact collection ----------------------------------------------------

  const enrichOne = useCallback(async (row: CustomerRecord): Promise<boolean> => {
    setEnriching((s) => ({ ...s, [row.id]: true }));
    try {
      const res = await fetch('/api/admin/customers/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          school: row.school,
          state: row.state,
          rosterLink: row.rosterLink,
          website: row.website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const updated = (data?.updated ?? {}) as Partial<CustomerRecord>;
      if (Object.keys(updated).length) {
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...updated, enrichedAt: new Date().toISOString() } : r)));
        return true;
      }
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, enrichedAt: new Date().toISOString() } : r)));
      setChecked((c) => ({ ...c, [row.id]: true }));
      return false;
    } catch {
      return false;
    } finally {
      setEnriching((s) => ({ ...s, [row.id]: false }));
    }
  }, []);

  /** Walk the visible rows that have no contact info and fill what we can. */
  async function fillMissing() {
    if (fill) {
      fillRun.current++; // cancel
      setFill(null);
      return;
    }
    const targets = missingContact.slice(0, 40);
    if (!targets.length) {
      setMsg('Every school in view already has contact info.');
      return;
    }
    const run = ++fillRun.current;
    setMsg('');
    setFill({ done: 0, total: targets.length });
    let found = 0;
    let idx = 0;
    const worker = async () => {
      while (idx < targets.length && fillRun.current === run) {
        const row = targets[idx++];
        if (await enrichOne(row)) found++;
        if (fillRun.current === run) setFill({ done: Math.min(idx, targets.length), total: targets.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]); // 3 at a time — stay polite
    if (fillRun.current !== run) return;
    setFill(null);
    setMsg(`Contact lookup finished — filled ${found} of ${targets.length} school${targets.length === 1 ? '' : 's'}.`);
  }

  // --- Import / export -------------------------------------------------------

  const parsedImport = useMemo(() => parseImport(importText), [importText]);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = ''; // let the same file be chosen again
  }

  async function importRows() {
    const recs = parsedImport?.records ?? [];
    if (!recs.length) return;
    setImporting(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: recs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Import failed.');
        return;
      }
      setMsg(`Imported ${data.inserted} row${data.inserted === 1 ? '' : 's'}.`);
      setImportText('');
      setImportOpen(false);
      setPage(1);
      await load();
    } finally {
      setImporting(false);
    }
  }

  /** Export exactly what's on screen, in the order it's on screen. */
  function exportCsv() {
    const blob = new Blob([customerCsv(ranked)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename(query ? 'hydra-customers-search' : 'hydra-customers');
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Render ----------------------------------------------------------------

  return (
    <div>
      <div className="crm-head">
        <div>
          <h1 className="admin-h1">Customer List</h1>
          <p className="cl-sub">
            Ranked by how likely each program is to buy — Tier A first. Search, tier, and contact
            details are filled in for you; all that's left is the reach-out.
          </p>
        </div>
        <div className="crm-actions">
          <div className="cl-toggle" role="group" aria-label="View">
            <button
              className={view === 'queue' ? 'active' : undefined}
              onClick={() => chooseView('queue')}
            >
              Queue
            </button>
            <button
              className={view === 'sheet' ? 'active' : undefined}
              onClick={() => chooseView('sheet')}
            >
              Sheet
            </button>
          </div>
          <button className="solid-btn" onClick={addRow}>+ Add row</button>
          <button className="ghost-btn" onClick={() => setImportOpen((o) => !o)}>
            {importOpen ? 'Close import' : 'Import'}
          </button>
          <button className="ghost-btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <section className="cl-search">
        <div className="cl-search-row">
          <span className="cl-search-icon" aria-hidden>⌕</span>
          <input
            className="cl-search-input"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search schools, conferences, coaches, notes…  or  state:pa  tier:a  has:email"
            aria-label="Search the customer list"
          />
          {query && (
            <button className="cl-search-clear" onClick={() => search('')} aria-label="Clear search">
              ✕
            </button>
          )}
          <select
            className="cl-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          <button className="mini-btn" onClick={() => setShowHelp((h) => !h)} title="Search tips">
            {showHelp ? 'Hide tips' : 'Tips'}
          </button>
        </div>

        <div className="cl-chip-row">
          {QUICK_SEARCHES.map((q, i) => (
            <button
              key={q.query}
              className={`cl-chip${query.trim() === q.query ? ' on' : ''}`}
              title={q.hint}
              onClick={() => search(query.trim() === q.query ? '' : q.query)}
            >
              {q.label} <span className="cl-chip-n">{quickCounts[i]}</span>
            </button>
          ))}
        </div>

        <div className="cl-chip-row">
          {TIERS.map((t) => (
            <button
              key={t}
              className={`cl-chip tier-chip tier-${t.toLowerCase()}${parsed.tiers.includes(t) ? ' on' : ''}`}
              title={TIER_META[t].blurb}
              onClick={() => search(toggleToken(query, `tier:${t.toLowerCase()}`))}
            >
              Tier {t} <span className="cl-chip-n">{tierCounts[t]}</span>
            </button>
          ))}
          <span className="cl-spacer" />
          <label className="cl-home">
            Home base
            <input
              className="cl-home-input"
              value={homeState}
              maxLength={2}
              placeholder="OH"
              onChange={(e) => chooseHome(e.target.value.toUpperCase())}
              title="Two-letter state — schools nearby score higher"
            />
          </label>
        </div>

        {showHelp && (
          <div className="cl-help">
            <p><strong>Type anything</strong> — it matches school, state, conference, coach, notes, and connections.</p>
            <ul>
              <li><code>state:pa</code> · <code>conf:mac</code> · <code>div:d3</code> · <code>coach:smith</code> — narrow to one column</li>
              <li><code>has:email</code> · <code>missing:contact</code> · <code>has:connection</code> — filter on what's filled in</li>
              <li><code>tier:a</code> · <code>status:new</code> · <code>status:contacted</code> — work the queue</li>
              <li><code>&quot;head coach&quot;</code> — exact phrase · <code>-juco</code> — leave these out</li>
            </ul>
            <p className="muted">
              Tiers come from the connection you have, the notes, the contact info on file, the
              division, and how close the school is to your home state. Hover a tier badge to see
              exactly why a school landed where it did.
            </p>
          </div>
        )}

        {parsed.chips.length > 0 && (
          <div className="cl-parsed">
            {parsed.chips.map((c, i) => (
              <span key={`${c.label}-${i}`} className={`cl-parsed-chip ${c.kind}`}>{c.label}</span>
            ))}
            <button className="mini-btn" onClick={() => search('')}>clear</button>
          </div>
        )}
      </section>

      {importOpen && (
        <section className="fin-card cl-import">
          <h2 className="fin-h2">Bulk import</h2>
          <p className="muted cl-import-help">
            Paste rows straight from Excel / Google Sheets, or choose a .csv file. Include a header
            row (State, School, Conference, 2026 Roster Link, Division, 1st Degree Conn, 1st Degree
            Notes, Instagram, Email, Notes — plus optional Coach, Phone, Website, Status) — or just
            keep the first ten columns in that order. Imported rows are added to the list.
          </p>
          <textarea
            className="cl-import-text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'Paste tab-separated rows here…'}
          />
          <div className="cl-import-bar">
            <label className="mini-btn cl-file">
              Choose CSV…
              <input type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={onFile} />
            </label>
            {parsedImport && (
              <span className="muted">
                {parsedImport.records.length} row{parsedImport.records.length === 1 ? '' : 's'} ·{' '}
                {parsedImport.headerDetected ? 'header detected' : 'no header — using column order'} ·{' '}
                {parsedImport.mapped.length} columns mapped
              </span>
            )}
            <span className="cl-spacer" />
            <button className="ghost-btn" onClick={() => { setImportOpen(false); setImportText(''); }}>
              Cancel
            </button>
            <button
              className="solid-btn"
              disabled={!parsedImport?.records.length || importing}
              onClick={importRows}
            >
              {importing ? 'Importing…' : `Import ${parsedImport?.records.length ?? 0} rows`}
            </button>
          </div>
          {parsedImport && parsedImport.records.length > 0 && (
            <div className="table-wrap cl-import-preview">
              <table className="data-table compact">
                <thead>
                  <tr>{parsedImport.mapped.map((f) => <th key={f}>{CUSTOMER_FIELD_LABELS[f]}</th>)}</tr>
                </thead>
                <tbody>
                  {parsedImport.records.slice(0, 5).map((rec, i) => (
                    <tr key={i}>
                      {parsedImport.mapped.map((f) => (
                        <td key={f}>{rec[f] || <span className="muted">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedImport.records.length > 5 && (
                <p className="muted cl-import-more">+ {parsedImport.records.length - 5} more…</p>
              )}
            </div>
          )}
        </section>
      )}

      {err && (
        <div className="admin-callout">
          <strong>Database not connected.</strong>
          <p>Run <code>db/migrations/2026-06-14-add-customers.sql</code> in your Neon SQL editor, then refresh.</p>
        </div>
      )}

      {!err && (
        <div className="cl-status-bar">
          <span className="admin-msg">
            {loading
              ? 'Loading…'
              : `${ranked.length}${ranked.length !== rows.length ? ` of ${rows.length}` : ''} school${ranked.length === 1 ? '' : 's'} · ${readyToEmail} with an email · ${missingContact.length} missing contact info`}
          </span>
          <span className="cl-spacer" />
          {fill ? (
            <>
              <span className="muted">Looking up contacts… {fill.done}/{fill.total}</span>
              <button className="mini-btn" onClick={fillMissing}>Stop</button>
            </>
          ) : (
            <button
              className="solid-btn cl-fill-btn"
              onClick={fillMissing}
              disabled={loading || !missingContact.length}
              title="Crawl each school's roster link / athletics site for a coach, email, and phone"
            >
              Find missing contacts{missingContact.length ? ` (${Math.min(missingContact.length, 40)})` : ''}
            </button>
          )}
        </div>
      )}

      {msg && <p className="admin-msg">{msg}</p>}

      {!loading && !err && ranked.length === 0 && (
        <p className="cl-empty muted">
          {rows.length === 0
            ? 'No schools yet — add a row or import your sheet.'
            : 'Nothing matches that search. Try fewer words, or clear the filters.'}
        </p>
      )}

      {!loading && !err && ranked.length > 0 && (
        view === 'queue' ? (
          <CustomerQueue
            items={pageItems}
            startIndex={start}
            enriching={enriching}
            checked={checked}
            onField={saveField}
            onPatch={patch}
            onEnrich={enrichOne}
            onContacted={markContacted}
          />
        ) : (
          <CustomerSheet
            items={pageItems}
            enriching={enriching}
            onField={saveField}
            onPatch={patch}
            onEnrich={enrichOne}
            onDelete={remove}
          />
        )
      )}

      {!loading && !err && ranked.length > 0 && (
        <div className="pagination">
          <span className="pagination-info">
            {start + 1}–{Math.min(start + PAGE_SIZE, ranked.length)} of {ranked.length}
          </span>
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                type="button"
                className="page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ← Prev
              </button>
              <span className="page-indicator">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                className="page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
