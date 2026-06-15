'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { parseImport } from '@/lib/customers-import';

interface Customer {
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
}

type FieldKey = Exclude<keyof Customer, 'id'>;

const COLUMNS: { key: FieldKey; label: string; type?: 'link' | 'instagram' | 'email'; wide?: boolean }[] = [
  { key: 'state', label: 'State' },
  { key: 'school', label: 'School', wide: true },
  { key: 'conference', label: 'Conference' },
  { key: 'rosterLink', label: '2026 Roster Link', type: 'link', wide: true },
  { key: 'division', label: 'Division' },
  { key: 'firstDegreeConn', label: '1st Degree Conn' },
  { key: 'firstDegreeNotes', label: '1st Degree Notes', wide: true },
  { key: 'instagram', label: 'Instagram', type: 'instagram' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'notes', label: 'Notes', wide: true },
];

const DIVISIONS = ['NCAA D1', 'NCAA D2', 'NCAA D3', 'NAIA', 'NJCAA D1', 'NJCAA D2', 'NJCAA D3'];

const PAGE_SIZE = 25;

function hrefFor(type: 'link' | 'instagram' | 'email' | undefined, value: string): string | null {
  if (!type) return null;
  if (type === 'email') return `mailto:${value}`;
  if (type === 'instagram') return /^https?:/i.test(value) ? value : `https://instagram.com/${value.replace(/^@/, '')}`;
  return /^https?:/i.test(value) ? value : `https://${value}`;
}

export default function CustomerListPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');
  const [colFilters, setColFilters] = useState<Partial<Record<FieldKey, string>>>({});
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

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

  const displayed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const active = COLUMNS
      .map((c) => [c.key, (colFilters[c.key] ?? '').trim().toLowerCase()] as const)
      .filter(([, v]) => v !== '');
    return rows.filter((r) => {
      if (q && !COLUMNS.some((c) => (r[c.key] ?? '').toLowerCase().includes(q))) return false;
      return active.every(([key, v]) => (r[key] ?? '').toLowerCase().includes(v));
    });
  }, [rows, filter, colFilters]);

  const anyFilter = filter.trim() !== '' || Object.values(colFilters).some((v) => (v ?? '').trim() !== '');
  function clearFilters() {
    setFilter('');
    setColFilters({});
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = displayed.slice(start, start + PAGE_SIZE);

  async function save(row: Customer, key: FieldKey, raw: string) {
    const value = raw.trim();
    if ((row[key] ?? '') === value) return; // unchanged
    const updated = { ...row, [key]: value || null };
    setRows((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    await fetch('/api/admin/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  async function addRow() {
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setRows((rs) => [data.customer, ...rs]);
      setPage(1);
    } else setErr(data.error || 'Add failed.');
  }

  async function remove(id: number) {
    if (!confirm('Delete this row?')) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await fetch(`/api/admin/customers?id=${id}`, { method: 'DELETE' });
  }

  const parsed = useMemo(() => parseImport(importText), [importText]);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = ''; // let the same file be chosen again
  }

  async function importRows() {
    const recs = parsed?.records ?? [];
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

  return (
    <div>
      <div className="crm-head">
        <h1 className="admin-h1">Customer List</h1>
        <div className="crm-actions">
          <input
            className="cl-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter…"
          />
          <button className="solid-btn" onClick={addRow}>+ Add row</button>
          <button className="ghost-btn" onClick={() => setImportOpen((o) => !o)}>
            {importOpen ? 'Close import' : 'Import'}
          </button>
          <a className="btn-link" href="/api/admin/customers?format=csv">Export CSV</a>
        </div>
      </div>

      {msg && <p className="admin-msg">{msg}</p>}

      {importOpen && (
        <section className="fin-card cl-import">
          <h2 className="fin-h2">Bulk import</h2>
          <p className="muted cl-import-help">
            Paste rows straight from Excel / Google Sheets, or choose a .csv file. Include a header
            row (State, School, Conference, 2026 Roster Link, Division, 1st Degree Conn, 1st Degree
            Notes, Instagram, Email, Notes) — or just keep the columns in that order. Imported rows
            are added to the list.
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
            {parsed && (
              <span className="muted">
                {parsed.records.length} row{parsed.records.length === 1 ? '' : 's'} ·{' '}
                {parsed.headerDetected ? 'header detected' : 'no header — using column order'} ·{' '}
                {parsed.mapped.length} columns mapped
              </span>
            )}
            <span className="cl-spacer" />
            <button className="ghost-btn" onClick={() => { setImportOpen(false); setImportText(''); }}>
              Cancel
            </button>
            <button className="solid-btn" disabled={!parsed?.records.length || importing} onClick={importRows}>
              {importing ? 'Importing…' : `Import ${parsed?.records.length ?? 0} rows`}
            </button>
          </div>
          {parsed && parsed.records.length > 0 && (
            <div className="table-wrap cl-import-preview">
              <table className="data-table compact">
                <thead><tr>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {parsed.records.slice(0, 5).map((rec, i) => (
                    <tr key={i}>
                      {COLUMNS.map((c) => (
                        <td key={c.key}>{rec[c.key] || <span className="muted">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.records.length > 5 && (
                <p className="muted cl-import-more">+ {parsed.records.length - 5} more…</p>
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
        <p className="admin-msg">
          {loading ? 'Loading…' : `${displayed.length}${filter ? ` of ${rows.length}` : ''} school${displayed.length === 1 ? '' : 's'}`}
        </p>
      )}

      <datalist id="cl-divisions">
        {DIVISIONS.map((d) => <option key={d} value={d} />)}
      </datalist>

      {!loading && !err && (
        <>
        <div className="table-wrap">
          <table className="data-table customer-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => <th key={c.key} className={c.wide ? 'wide' : undefined}>{c.label}</th>)}
                <th></th>
              </tr>
              <tr className="cl-filter-row">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={c.wide ? 'wide' : undefined}>
                    <input
                      className="cl-col-filter"
                      value={colFilters[c.key] ?? ''}
                      placeholder="filter…"
                      onChange={(e) => {
                        setColFilters((f) => ({ ...f, [c.key]: e.target.value }));
                        setPage(1);
                      }}
                    />
                  </th>
                ))}
                <th>
                  {anyFilter && (
                    <button className="mini-btn" onClick={clearFilters} title="Clear all filters">clear</button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id}>
                  {COLUMNS.map((c) => {
                    const val = r[c.key] ?? '';
                    const href = val ? hrefFor(c.type, val) : null;
                    return (
                      <td key={c.key} className={c.wide ? 'wide' : undefined}>
                        <div className="cl-cell">
                          <input
                            className="cl-input"
                            defaultValue={val}
                            list={c.key === 'division' ? 'cl-divisions' : undefined}
                            onBlur={(e) => save(r, c.key, e.target.value)}
                          />
                          {href && (
                            <a className="cl-ext" href={href} target="_blank" rel="noreferrer" title="Open">↗</a>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <button className="link-danger" aria-label="Delete row" onClick={() => remove(r.id)}>✕</button>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                    {rows.length === 0 ? 'No schools yet — click “Add row”.' : 'No matches for that filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {displayed.length > 0 && (
          <div className="pagination">
            <span className="pagination-info">
              {start + 1}–{Math.min(start + PAGE_SIZE, displayed.length)} of {displayed.length}
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
                <span className="page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
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
        </>
      )}
    </div>
  );
}
