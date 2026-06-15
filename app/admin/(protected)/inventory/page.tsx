'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

interface Item {
  id: number;
  sku: string | null;
  name: string | null;
  category: string | null;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  unitPrice: number;
  supplier: string | null;
  location: string | null;
  notes: string | null;
}

interface Movement {
  id: number;
  delta: number;
  kind: string;
  reason: string | null;
  createdAt: string;
}

type EditKey =
  | 'sku' | 'name' | 'category' | 'supplier' | 'location' | 'notes'
  | 'reorderLevel' | 'unitCost' | 'unitPrice';

const NUM_KEYS: EditKey[] = ['reorderLevel', 'unitCost', 'unitPrice'];
const PAGE_SIZE = 25;
const TOTAL_COLS = 12; // for the history row colSpan

const isLow = (it: Item) => it.reorderLevel > 0 && it.quantity <= it.reorderLevel;

const money = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Per-row stock-adjust amount + which item's history is open.
  const [qty, setQty] = useState<Record<number, string>>({});
  const [openLog, setOpenLog] = useState<number | null>(null);
  const [log, setLog] = useState<Movement[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/inventory');
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to load.');
        return;
      }
      setErr('');
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return items.filter((it) => {
      if (lowOnly && !isLow(it)) return false;
      if (!q) return true;
      return [it.sku, it.name, it.category, it.supplier, it.location, it.notes]
        .some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [items, filter, lowOnly]);

  const totals = useMemo(() => {
    let units = 0;
    let value = 0;
    let low = 0;
    for (const it of items) {
      units += it.quantity;
      value += it.quantity * it.unitCost;
      if (isLow(it)) low += 1;
    }
    return { units, value, low };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = displayed.slice(start, start + PAGE_SIZE);

  async function addItem() {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setItems((rs) => [data.item, ...rs]);
      setPage(1);
      setErr('');
    } else {
      setErr(data.error || 'Add failed.');
    }
  }

  async function save(item: Item, key: EditKey, raw: string) {
    const isNum = NUM_KEYS.includes(key);
    const next: string | number | null = isNum
      ? key === 'reorderLevel'
        ? Math.trunc(Number(raw) || 0)
        : Number(raw) || 0
      : raw.trim() || null;
    const prev = item[key];
    if (String(prev ?? '') === String(next ?? '')) return; // unchanged
    const updated = { ...item, [key]: next };
    setItems((rs) => rs.map((r) => (r.id === item.id ? updated : r)));
    await fetch('/api/admin/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  async function move(item: Item, sign: 1 | -1) {
    const amount = Math.trunc(Number(qty[item.id] ?? '1'));
    if (!amount || amount <= 0) {
      setErr('Enter a quantity greater than 0.');
      return;
    }
    setBusy((b) => ({ ...b, [item.id]: true }));
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          move: { id: item.id, delta: sign * amount, kind: sign > 0 ? 'receive' : 'ship' },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Stock update failed.');
        return;
      }
      setErr('');
      setMsg(`${sign > 0 ? 'Received' : 'Shipped'} ${amount} × ${item.name || 'item'}.`);
      setItems((rs) => rs.map((r) => (r.id === item.id ? { ...r, quantity: data.quantity } : r)));
      if (openLog === item.id) loadLog(item.id);
    } finally {
      setBusy((b) => ({ ...b, [item.id]: false }));
    }
  }

  const loadLog = useCallback(async (id: number) => {
    setLogLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory?movements=${id}`);
      const data = await res.json();
      setLog(res.ok ? data.movements : []);
    } finally {
      setLogLoading(false);
    }
  }, []);

  function toggleLog(id: number) {
    if (openLog === id) {
      setOpenLog(null);
      return;
    }
    setOpenLog(id);
    loadLog(id);
  }

  async function remove(id: number) {
    if (!confirm('Delete this item and its stock history?')) return;
    setItems((rs) => rs.filter((r) => r.id !== id));
    if (openLog === id) setOpenLog(null);
    await fetch(`/api/admin/inventory?id=${id}`, { method: 'DELETE' });
  }

  function resetPage() {
    setPage(1);
  }

  const editCell = (item: Item, key: EditKey, opts: { wide?: boolean; num?: boolean } = {}) => (
    <td className={opts.wide ? 'wide' : undefined}>
      <input
        className={`cl-input${opts.num ? ' num' : ''}`}
        type={opts.num ? 'number' : 'text'}
        step={opts.num ? 'any' : undefined}
        defaultValue={item[key] == null ? '' : String(item[key])}
        onBlur={(e) => save(item, key, e.target.value)}
      />
    </td>
  );

  return (
    <div>
      <div className="crm-head">
        <h1 className="admin-h1">Inventory</h1>
        <div className="crm-actions">
          <input
            className="cl-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              resetPage();
            }}
            placeholder="Filter…"
          />
          <label className="chk">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => {
                setLowOnly(e.target.checked);
                resetPage();
              }}
            />
            Low stock only
          </label>
          <button className="solid-btn" onClick={addItem}>+ Add item</button>
          <a className="btn-link" href="/api/admin/inventory?format=csv">Export CSV</a>
        </div>
      </div>

      {msg && <p className="admin-msg">{msg}</p>}

      {err && (
        <div className="admin-callout">
          <strong>Couldn’t load inventory.</strong>
          <p>
            {err} Run <code>db/migrations/2026-06-15-add-inventory.sql</code> in your Neon SQL
            editor, then refresh.
          </p>
        </div>
      )}

      {!err && (
        <p className="admin-msg">
          {loading
            ? 'Loading…'
            : `${items.length} item${items.length === 1 ? '' : 's'} · ${totals.units} on hand · ${money(totals.value)} at cost · ${totals.low} low`}
        </p>
      )}

      {!loading && !err && (
        <>
          <div className="table-wrap">
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="wide">Name</th>
                  <th>Category</th>
                  <th>On hand</th>
                  <th>Reorder</th>
                  <th>Unit cost</th>
                  <th>Unit price</th>
                  <th>Supplier</th>
                  <th>Location</th>
                  <th className="wide">Notes</th>
                  <th>Adjust stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      {editCell(item, 'sku')}
                      {editCell(item, 'name', { wide: true })}
                      {editCell(item, 'category')}
                      <td>
                        <span className="inv-onhand">
                          <span className={isLow(item) ? 'inv-qty low' : 'inv-qty'}>
                            {item.quantity}
                          </span>
                          {isLow(item) && <span className="low-badge">low</span>}
                        </span>
                      </td>
                      {editCell(item, 'reorderLevel', { num: true })}
                      {editCell(item, 'unitCost', { num: true })}
                      {editCell(item, 'unitPrice', { num: true })}
                      {editCell(item, 'supplier')}
                      {editCell(item, 'location')}
                      {editCell(item, 'notes', { wide: true })}
                      <td>
                        <div className="inv-stock">
                          <input
                            className="inv-amt"
                            type="number"
                            min="1"
                            value={qty[item.id] ?? '1'}
                            onChange={(e) => setQty((q) => ({ ...q, [item.id]: e.target.value }))}
                            aria-label="Quantity to receive or ship"
                          />
                          <button
                            className="mini-btn in"
                            disabled={busy[item.id]}
                            onClick={() => move(item, 1)}
                            title="Receive stock (add to on hand)"
                          >
                            + In
                          </button>
                          <button
                            className="mini-btn out"
                            disabled={busy[item.id]}
                            onClick={() => move(item, -1)}
                            title="Ship / remove stock (subtract from on hand)"
                          >
                            − Out
                          </button>
                          <button
                            className="mini-btn"
                            onClick={() => toggleLog(item.id)}
                            title="Movement history"
                          >
                            {openLog === item.id ? 'Hide' : 'Log'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className="link-danger"
                          aria-label="Delete item"
                          onClick={() => remove(item.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                    {openLog === item.id && (
                      <tr className="inv-log-row">
                        <td colSpan={TOTAL_COLS}>
                          {logLoading ? (
                            <span className="muted">Loading history…</span>
                          ) : log.length === 0 ? (
                            <span className="muted">No stock movements yet.</span>
                          ) : (
                            <ul className="inv-log">
                              {log.map((m) => (
                                <li key={m.id}>
                                  <span className={m.delta >= 0 ? 'pos' : 'neg'}>
                                    {m.delta >= 0 ? '+' : ''}
                                    {m.delta}
                                  </span>
                                  <span className="inv-log-kind">{m.kind}</span>
                                  <span className="muted">
                                    {new Date(m.createdAt).toLocaleString()}
                                  </span>
                                  {m.reason && <span className="muted">· {m.reason}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={TOTAL_COLS} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                      {items.length === 0
                        ? 'No items yet — click “Add item”, then use + In to receive stock.'
                        : 'No items match that filter.'}
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
