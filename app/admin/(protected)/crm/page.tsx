'use client';

import { useCallback, useEffect, useState } from 'react';

interface Row {
  id: number;
  name: string;
  type: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  level?: string | null;
  source: string;
  notes?: string | null;
  created_at: string;
  enrichedNone?: boolean;
}

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

export default function CrmPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [enriching, setEnriching] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm' + (filter ? `?status=${filter}` : ''));
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to load. Is the database connected?');
        return;
      }
      setErr('');
      setRows(data.prospects);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: number, status: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  }

  async function remove(id: number) {
    if (!confirm('Remove this prospect?')) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await fetch(`/api/admin/crm?id=${id}`, { method: 'DELETE' });
  }

  async function enrich(r: Row) {
    if (!r.website) return;
    setEnriching((s) => ({ ...s, [r.id]: true }));
    try {
      const res = await fetch('/api/admin/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: r.website }),
      });
      const data = await res.json();
      if (data.email || data.phone) {
        await fetch('/api/admin/crm', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id, email: data.email ?? undefined, phone: data.phone ?? undefined }),
        });
        setRows((rs) =>
          rs.map((x) => (x.id === r.id ? { ...x, email: data.email ?? x.email, phone: data.phone ?? x.phone } : x)),
        );
      } else {
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, enrichedNone: true } : x)));
      }
    } finally {
      setEnriching((s) => ({ ...s, [r.id]: false }));
    }
  }

  return (
    <div>
      <div className="crm-head">
        <h1 className="admin-h1">CRM</h1>
        <div className="crm-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <a className="btn-link" href="/api/admin/crm?format=csv">
            Export CSV
          </a>
        </div>
      </div>

      {err && <p className="admin-msg">{err}</p>}

      {loading ? (
        <p className="admin-msg">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="admin-msg">
          No prospects yet. Go to <strong>Find Prospects</strong> to add some.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.website ? (
                      <a href={r.website} target="_blank" rel="noreferrer">
                        {r.name}
                      </a>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td>{r.type}</td>
                  <td>{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    {r.phone || r.email ? (
                      <span>{r.phone || r.email}</span>
                    ) : enriching[r.id] ? (
                      <span className="muted">looking…</span>
                    ) : r.enrichedNone ? (
                      <span className="muted">none found</span>
                    ) : r.website ? (
                      <button type="button" className="mini-btn" onClick={() => enrich(r)}>
                        Find contact
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      className={`status status-${r.status}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="link-danger" onClick={() => remove(r.id)} aria-label="Remove">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
