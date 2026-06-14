'use client';

import { useState, type FormEvent } from 'react';

interface Prospect {
  name: string;
  type: string;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  source: string;
  sourceId: string;
  level?: string | null;
}

export default function ProspectsPage() {
  const [type, setType] = useState('facility');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(80);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function search(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    setResults([]);
    setSelected({});
    try {
      const res = await fetch('/api/admin/prospects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, location, radiusKm, keyword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Search failed.');
        return;
      }
      setResults(data.results);
      if (!data.results.length) setMsg('No results — try a wider radius or a different location.');
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }
  function toggleAll() {
    if (selectedCount === results.length) {
      setSelected({});
    } else {
      const all: Record<string, boolean> = {};
      results.forEach((r) => (all[r.sourceId] = true));
      setSelected(all);
    }
  }

  async function save() {
    const chosen = results.filter((r) => selected[r.sourceId]);
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
      setMsg(res.ok ? `Saved ${data.saved} prospect(s) to the CRM.` : data.error || 'Save failed.');
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
            <option value="facility">Facilities (cages, fields, complexes)</option>
            <option value="college">Colleges</option>
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
          Radius (km)
          <input
            type="number"
            value={radiusKm}
            min={1}
            max={200}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
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
          <div className="results-actions">
            <span>{results.length} found</span>
            <button type="button" onClick={toggleAll}>
              {selectedCount === results.length ? 'Clear' : 'Select all'}
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
                  <th>Location</th>
                  <th>Phone</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.sourceId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selected[r.sourceId]}
                        onChange={() => toggle(r.sourceId)}
                      />
                    </td>
                    <td>{r.name}</td>
                    <td>{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{r.phone || '—'}</td>
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
