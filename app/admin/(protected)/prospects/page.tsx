'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';

interface Prospect {
  name: string;
  type: string;
  level?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  source: string;
  sourceId: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceMi?: number | null;
  saved?: boolean;
  enrichedNone?: boolean;
}

const hasContact = (r: Prospect) => Boolean(r.phone || r.email || r.contactName);
const isUnnamed = (r: Prospect) => r.level === 'unnamed field';
const TYPE_LABELS: Record<string, string> = {
  facility: 'Facility',
  highschool: 'High school',
  college: 'College',
  league: 'League',
};

export default function ProspectsPage() {
  const [type, setType] = useState('all');
  const [location, setLocation] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [enriching, setEnriching] = useState<Record<string, boolean>>({});
  const [autoFilling, setAutoFilling] = useState(false);

  // Filters
  const [onlyContact, setOnlyContact] = useState(false);
  const [hideUnnamed, setHideUnnamed] = useState(true);

  // Tracks the active search so stale auto-enrichment cancels itself.
  const runRef = useRef(0);

  // Automatically fill contact info across results (quick mode, throttled).
  async function autoEnrich(list: Prospect[], run: number) {
    const targets = list
      .filter((r) => r.website && !hasContact(r) && !r.saved)
      .slice(0, 40);
    if (!targets.length) return;
    setAutoFilling(true);
    let idx = 0;
    const worker = async () => {
      while (idx < targets.length && runRef.current === run) {
        const r = targets[idx++];
        setEnriching((s) => ({ ...s, [r.sourceId]: true }));
        try {
          const res = await fetch('/api/admin/prospects/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ website: r.website, deep: false }),
          });
          const data = await res.json();
          if (runRef.current !== run) return;
          const found = Boolean(data.email || data.phone || data.contactName);
          setResults((rs) =>
            rs.map((x) =>
              x.sourceId === r.sourceId
                ? {
                    ...x,
                    email: data.email ?? x.email,
                    phone: data.phone ?? x.phone,
                    contactName: data.contactName ?? x.contactName,
                    enrichedNone: !found,
                  }
                : x,
            ),
          );
        } catch {
          /* ignore one failed lookup */
        } finally {
          setEnriching((s) => ({ ...s, [r.sourceId]: false }));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]); // 3 concurrent
    if (runRef.current === run) setAutoFilling(false);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    const run = ++runRef.current; // cancel any in-flight auto-enrichment
    setLoading(true);
    setMsg('');
    setResults([]);
    setSelected({});
    setAutoFilling(false);
    try {
      const res = await fetch('/api/admin/prospects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, location, radiusMiles, keyword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Search failed.');
        return;
      }
      setResults(data.results);
      if (!data.results.length) setMsg('No results — try a wider radius or a different location.');
      else autoEnrich(data.results, run);
    } finally {
      setLoading(false);
    }
  }

  const displayed = useMemo(
    () => results.filter((r) => (!onlyContact || hasContact(r)) && (!hideUnnamed || !isUnnamed(r))),
    [results, onlyContact, hideUnnamed],
  );

  const selectable = displayed.filter((r) => !r.saved);
  const selectedCount = selectable.filter((r) => selected[r.sourceId]).length;
  const withContact = results.filter(hasContact).length;

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }
  function toggleAll() {
    if (selectedCount === selectable.length) {
      setSelected({});
    } else {
      const all: Record<string, boolean> = {};
      selectable.forEach((r) => (all[r.sourceId] = true));
      setSelected(all);
    }
  }

  async function save() {
    const chosen = selectable.filter((r) => selected[r.sourceId]);
    if (!chosen.length) {
      setMsg('Select at least one prospect to save.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: chosen }),
      });
      const data = await res.json();
      if (res.ok) {
        const ids = new Set(chosen.map((c) => c.sourceId));
        setResults((rs) => rs.map((r) => (ids.has(r.sourceId) ? { ...r, saved: true } : r)));
        setSelected({});
        setMsg(`Saved ${data.saved} prospect(s) to the CRM.`);
      } else {
        setMsg(data.error || 'Save failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="admin-h1">Find Prospects</h1>

      <form className="search-form" onSubmit={search}>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types (everything in radius)</option>
            <option value="facility">Facilities (cages, fields, complexes)</option>
            <option value="highschool">High schools</option>
            <option value="college">Colleges</option>
            <option value="league">Youth &amp; travel leagues</option>
          </select>
        </label>
        <label>
          Location (city, ST or ZIP)
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Columbus, OH or 43004"
          />
        </label>
        <label>
          Radius (miles)
          <input
            type="number"
            value={radiusMiles}
            min={1}
            max={200}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
          />
        </label>
        <label>
          Keyword (optional)
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="batting, academy…"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {msg && <p className="admin-msg">{msg}</p>}

      {results.length > 0 && (
        <>
          <div className="results-bar">
            <div className="results-counts">
              <strong>{displayed.length}</strong> shown
              <span className="dot">·</span>
              {withContact} with contact
              <span className="dot">·</span>
              {results.length} total
              {autoFilling && <span className="auto-fill"> · auto-filling contacts…</span>}
            </div>
            <label className="chk">
              <input type="checkbox" checked={onlyContact} onChange={(e) => setOnlyContact(e.target.checked)} />
              Only with contact info
            </label>
            <label className="chk">
              <input type="checkbox" checked={hideUnnamed} onChange={(e) => setHideUnnamed(e.target.checked)} />
              Hide unnamed fields
            </label>
          </div>

          <div className="results-actions">
            <button type="button" onClick={toggleAll} disabled={!selectable.length}>
              {selectedCount === selectable.length && selectable.length > 0 ? 'Clear' : 'Select all'}
            </button>
            <button type="button" className="primary" onClick={save} disabled={loading || !selectedCount}>
              Save {selectedCount || ''} to CRM
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Dist.</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Coach / Contact</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr key={r.sourceId} className={r.saved ? 'row-saved' : undefined}>
                    <td>
                      {r.saved ? (
                        <span className="saved-badge" title="Already in CRM">✓</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!selected[r.sourceId]}
                          onChange={() => toggle(r.sourceId)}
                        />
                      )}
                    </td>
                    <td>{r.name}</td>
                    <td className="muted">{r.level || TYPE_LABELS[r.type] || r.type}</td>
                    <td className="muted">{r.distanceMi != null ? `${r.distanceMi} mi` : '—'}</td>
                    <td>{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>
                      {r.phone || r.email ? (
                        <span>{r.phone || r.email}</span>
                      ) : enriching[r.sourceId] ? (
                        <span className="muted">looking…</span>
                      ) : r.enrichedNone ? (
                        <span className="muted">none found</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="muted">
                      {r.contactName ? r.contactName : enriching[r.sourceId] ? '…' : '—'}
                    </td>
                    <td>
                      {r.website ? (
                        <a href={r.website} target="_blank" rel="noreferrer">
                          link
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
