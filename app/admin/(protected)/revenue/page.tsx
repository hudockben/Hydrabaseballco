'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { orderEconomics, priceForQty, pct, round2, usd, type Product } from '@/lib/finance';

const n = (v: string): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

interface Econ {
  revenue: number; cogs: number; shipping: number; other: number; profit: number; marginPct: number | null;
}
interface Order {
  id: number;
  prospectId: number | null;
  productId: number | null;
  customerName: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  shippingCost: number;
  otherCost: number;
  status: string;
  orderedAt: string;
  notes: string | null;
  econ: Econ;
}
interface Summary extends Econ {
  unitsSold: number;
  orderCount: number;
  counting: string;
  excludedCount: number;
  byProduct: { name: string; units: number; revenue: number; profit: number; marginPct: number | null }[];
  byMonth: { month: string; revenue: number; profit: number; marginPct: number | null }[];
}
interface WonProspect { id: number; name: string }

/** One editable order. Strings throughout so a half-typed number stays typeable. */
interface Draft {
  id: number;
  prospectId: string;
  productId: string;
  customerName: string;
  quantity: string;
  unitPrice: string;
  unitCost: string;
  shipping: string;
  other: string;
  status: string;
  orderedAt: string;
  notes: string;
}

const STATUSES = ['quote', 'confirmed', 'fulfilled', 'paid'];

// What rolls into the headline totals. A quote isn't money in the door, so
// which of these is "revenue" is a bookkeeping choice — make it an explicit one.
const COUNTING: { value: string; label: string }[] = [
  { value: 'all', label: 'All orders (incl. quotes)' },
  { value: 'booked', label: 'Booked (confirmed + fulfilled + paid)' },
  { value: 'paid', label: 'Paid only' },
];

const today = () => new Date().toISOString().slice(0, 10);

const draftFrom = (o: Order): Draft => ({
  id: o.id,
  prospectId: o.prospectId ? String(o.prospectId) : '',
  productId: o.productId ? String(o.productId) : '',
  customerName: o.customerName ?? '',
  quantity: String(o.quantity),
  unitPrice: String(o.unitPrice),
  unitCost: String(o.unitCost),
  shipping: String(o.shippingCost),
  other: String(o.otherCost),
  status: o.status,
  orderedAt: o.orderedAt,
  notes: o.notes ?? '',
});

export default function RevenuePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [won, setWon] = useState<WonProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [counting, setCounting] = useState('all');

  // Form
  const [prospectId, setProspectId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [unitPrice, setUnitPrice] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [shipping, setShipping] = useState('');
  const [other, setOther] = useState('');
  const [status, setStatus] = useState('confirmed');
  const [orderedAt, setOrderedAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [shipTouched, setShipTouched] = useState(false);
  const [costTouched, setCostTouched] = useState(false);

  // Inline edit
  const [edit, setEdit] = useState<Draft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, wRes] = await Promise.all([
        fetch(`/api/admin/orders?counting=${counting}`),
        fetch('/api/admin/products'),
        fetch('/api/admin/crm?status=won'),
      ]);
      const oData = await oRes.json();
      if (!oRes.ok) {
        setErr(oData.error || 'Failed to load orders.');
        return;
      }
      setErr('');
      setOrders(oData.orders);
      setSummary(oData.summary);
      if (pRes.ok) setProducts((await pRes.json()).products ?? []);
      if (wRes.ok) {
        const rows = (await wRes.json()).prospects ?? [];
        setWon(rows.map((r: { id: number; name: string }) => ({ id: r.id, name: r.name })));
      }
    } finally {
      setLoading(false);
    }
  }, [counting]);

  useEffect(() => {
    load();
  }, [load]);

  const product = useMemo(() => products.find((p) => String(p.id) === productId) ?? null, [products, productId]);

  // Suggest unit price from the product's volume tiers + a shipping default,
  // unless the user has typed their own. Recompute when product/qty change.
  useEffect(() => {
    if (!product) return;
    const qty = Math.floor(n(quantity));
    if (!costTouched) setUnitCost(String(product.unitCost));
    if (!priceTouched) {
      const tierPrice = priceForQty(product.tiers, qty);
      if (tierPrice != null) setUnitPrice(String(tierPrice));
    }
    if (!shipTouched) setShipping(String(round2(product.shipCost * qty)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, quantity]);

  const econ = orderEconomics({
    quantity: Math.floor(n(quantity)),
    unitPrice: n(unitPrice),
    unitCost: n(unitCost),
    shipping: n(shipping),
    other: n(other),
  });

  // Live economics for the row being edited, so the effect of a change is
  // visible before it is saved.
  const editEcon = edit
    ? orderEconomics({
        quantity: Math.floor(n(edit.quantity)),
        unitPrice: n(edit.unitPrice),
        unitCost: n(edit.unitCost),
        shipping: n(edit.shipping),
        other: n(edit.other),
      })
    : null;

  function resetForm() {
    setProspectId(''); setProductId(''); setQuantity('100'); setUnitPrice(''); setUnitCost('');
    setShipping(''); setOther(''); setStatus('confirmed'); setOrderedAt(today()); setNotes('');
    setPriceTouched(false); setShipTouched(false); setCostTouched(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!Math.floor(n(quantity))) {
      setMsg('Enter a quantity.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: prospectId || undefined,
          productId: productId || undefined,
          quantity: Math.floor(n(quantity)),
          unitPrice: n(unitPrice),
          unitCost: n(unitCost),
          shippingCost: n(shipping),
          otherCost: n(other),
          status,
          orderedAt,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Save failed.');
        return;
      }
      setMsg('Sale recorded.');
      resetForm();
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this order?')) return;
    if (edit?.id === id) setEdit(null);
    setOrders((os) => os.filter((o) => o.id !== id));
    await fetch(`/api/admin/orders?id=${id}`, { method: 'DELETE' });
    await load();
  }

  async function setOrderStatus(id: number, s: string) {
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: s } : o)));
    await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: s }),
    });
    // Status decides what counts toward the totals, so re-read them.
    await load();
  }

  function startEdit(o: Order) {
    setMsg('');
    setEdit(draftFrom(o));
  }

  /** Pull unit cost, tier price and shipping back from the product at this qty. */
  function repriceEdit() {
    if (!edit) return;
    const p = products.find((x) => String(x.id) === edit.productId);
    if (!p) {
      setMsg('Pick a product first to reprice from it.');
      return;
    }
    const qty = Math.floor(n(edit.quantity));
    const tierPrice = priceForQty(p.tiers, qty);
    setEdit({
      ...edit,
      unitCost: String(p.unitCost),
      shipping: String(round2(p.shipCost * qty)),
      unitPrice: tierPrice != null ? String(tierPrice) : edit.unitPrice,
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const qty = Math.floor(n(edit.quantity));
    if (!qty) {
      setMsg('Enter a quantity.');
      return;
    }
    setSavingEdit(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: edit.id,
          prospectId: edit.prospectId || null,
          productId: edit.productId || null,
          customerName: edit.customerName,
          quantity: qty,
          unitPrice: n(edit.unitPrice),
          unitCost: n(edit.unitCost),
          shippingCost: n(edit.shipping),
          otherCost: n(edit.other),
          status: edit.status,
          orderedAt: edit.orderedAt,
          notes: edit.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Update failed.');
        return;
      }
      setEdit(null);
      setMsg('Order updated.');
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      <div className="crm-head">
        <h1 className="admin-h1">Revenue &amp; Profit</h1>
        <div className="crm-actions">
          <button className="solid-btn" onClick={() => { setMsg(''); setShowForm((s) => !s); }}>
            {showForm ? 'Close' : '+ Record a sale'}
          </button>
        </div>
      </div>

      {err && <div className="admin-callout"><strong>Database not connected.</strong>
        <p>Run <code>db/migrations/2026-06-14-add-finance.sql</code> in your Neon SQL editor, then refresh.</p>
      </div>}
      {msg && <p className="admin-msg">{msg}</p>}

      {/* ---------- Summary ---------- */}
      {summary && (
        <>
          <div className="count-bar">
            <label className="fld inline">Counting
              <select value={counting} onChange={(e) => setCounting(e.target.value)}>
                {COUNTING.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            {summary.excludedCount > 0 && (
              <span className="count-note">
                {summary.excludedCount} order{summary.excludedCount === 1 ? '' : 's'} not counted
              </span>
            )}
          </div>

          <div className="stat-grid fin-stats">
            <div className="stat stat--total"><span className="stat-n">{usd(summary.revenue)}</span><span className="stat-l">Revenue</span></div>
            <div className="stat"><span className={`stat-n ${summary.profit < 0 ? 'neg' : 'pos'}`}>{usd(summary.profit)}</span><span className="stat-l">Profit</span></div>
            <div className="stat"><span className="stat-n">{pct(summary.marginPct)}</span><span className="stat-l">Margin</span></div>
            <div className="stat"><span className="stat-n">{usd(summary.cogs)}</span><span className="stat-l">COGS</span></div>
            <div className="stat"><span className="stat-n">{usd(summary.shipping)}</span><span className="stat-l">Shipping</span></div>
            <div className="stat"><span className="stat-n">{usd(summary.other)}</span><span className="stat-l">Other costs</span></div>
            <div className="stat"><span className="stat-n">{summary.unitsSold.toLocaleString()}</span><span className="stat-l">Units sold</span></div>
            <div className="stat"><span className="stat-n">{summary.orderCount}</span><span className="stat-l">Orders</span></div>
          </div>

          {/* Spell the profit out. Every cost that moves it is on this line, so
              the number can be checked by eye instead of taken on faith. */}
          <p className="fin-reconcile">
            <span>{usd(summary.revenue)} revenue</span>
            <span>− {usd(summary.cogs)} COGS</span>
            <span>− {usd(summary.shipping)} shipping</span>
            <span>− {usd(summary.other)} other</span>
            <span className="eq">= <strong className={summary.profit < 0 ? 'neg' : 'pos'}>{usd(summary.profit)}</strong> profit</span>
          </p>
        </>
      )}

      {/* ---------- Record a sale ---------- */}
      {showForm && (
        <form className="fin-card" onSubmit={submit}>
          <h2 className="fin-h2">Record a sale</h2>
          <div className="order-grid">
            <label className="fld">Won deal
              <select value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
                <option value="">— none / walk-in —</option>
                {won.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="fld">Product
              <select value={productId} onChange={(e) => { setProductId(e.target.value); setPriceTouched(false); setShipTouched(false); setCostTouched(false); }}>
                <option value="">— none —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="fld">Quantity
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            <label className="fld">Unit price
              <input type="number" step="0.01" min="0" value={unitPrice}
                onChange={(e) => { setUnitPrice(e.target.value); setPriceTouched(true); }} placeholder="4.50" /></label>
            <label className="fld">Unit cost (COGS)
              <input type="number" step="0.01" min="0" value={unitCost}
                onChange={(e) => { setUnitCost(e.target.value); setCostTouched(true); }} placeholder="2.50" /></label>
            <label className="fld">Shipping (total)
              <input type="number" step="0.01" min="0" value={shipping}
                onChange={(e) => { setShipping(e.target.value); setShipTouched(true); }} placeholder="0" /></label>
            <label className="fld">Other cost
              <input type="number" step="0.01" min="0" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0" /></label>
            <label className="fld">Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="fld">Date
              <input type="date" value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} /></label>
            <label className="fld grow">Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="PO #, terms…" /></label>
          </div>

          <div className="order-econ">
            <div><span>Revenue</span><strong>{usd(econ.revenue)}</strong></div>
            <div><span>COGS</span><strong>{usd(econ.cogs)}</strong></div>
            <div><span>Shipping</span><strong>{usd(econ.shipping)}</strong></div>
            <div><span>Other</span><strong>{usd(econ.other)}</strong></div>
            <div><span>Profit</span><strong className={econ.profit < 0 ? 'neg' : 'pos'}>{usd(econ.profit)}</strong></div>
            <div><span>Margin</span><strong>{pct(econ.marginPct)}</strong></div>
          </div>

          <div className="prod-form-actions">
            <button type="button" className="ghost-btn" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</button>
            <button type="submit" className="solid-btn" disabled={saving}>{saving ? 'Saving…' : 'Save sale'}</button>
          </div>
        </form>
      )}

      {/* ---------- Breakdowns ---------- */}
      {summary && summary.byProduct.length > 0 && (
        <div className="fin-split">
          <section className="fin-card">
            <h2 className="fin-h2">By product</h2>
            <table className="data-table compact">
              <thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead>
              <tbody>
                {summary.byProduct.map((b) => (
                  <tr key={b.name}><td>{b.name}</td><td>{b.units.toLocaleString()}</td><td>{usd(b.revenue)}</td>
                    <td className={b.profit < 0 ? 'neg' : undefined}>{usd(b.profit)}</td><td>{pct(b.marginPct)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="fin-card">
            <h2 className="fin-h2">By month</h2>
            <table className="data-table compact">
              <thead><tr><th>Month</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead>
              <tbody>
                {summary.byMonth.map((b) => (
                  <tr key={b.month}><td>{b.month}</td><td>{usd(b.revenue)}</td>
                    <td className={b.profit < 0 ? 'neg' : undefined}>{usd(b.profit)}</td><td>{pct(b.marginPct)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ---------- Orders ---------- */}
      <section className="fin-card">
        <h2 className="fin-h2">Orders</h2>

        {/* The editor sits above the table rather than inside it: the orders
            table scrolls sideways, and a form nested in a scrolling row puts
            half its fields off-screen. */}
        {edit && (
          <form className="order-edit" onSubmit={saveEdit}>
            <div className="order-edit-head">
              Editing the {edit.orderedAt} order
              {edit.customerName ? ` — ${edit.customerName}` : ''}
            </div>
            <div className="order-grid">
              <label className="fld">Won deal
                <select value={edit.prospectId} onChange={(e) => setEdit({ ...edit, prospectId: e.target.value })}>
                  <option value="">— none / walk-in —</option>
                  {won.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <label className="fld">Customer
                <input value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })}
                  placeholder="Walk-in / school name" /></label>
              <label className="fld">Product
                <select value={edit.productId} onChange={(e) => setEdit({ ...edit, productId: e.target.value })}>
                  <option value="">— none —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="fld">Quantity
                <input type="number" min="1" value={edit.quantity}
                  onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} /></label>
              <label className="fld">Unit price
                <input type="number" step="0.01" min="0" value={edit.unitPrice}
                  onChange={(e) => setEdit({ ...edit, unitPrice: e.target.value })} /></label>
              <label className="fld">Unit cost (COGS)
                <input type="number" step="0.01" min="0" value={edit.unitCost}
                  onChange={(e) => setEdit({ ...edit, unitCost: e.target.value })} /></label>
              <label className="fld">Shipping (total)
                <input type="number" step="0.01" min="0" value={edit.shipping}
                  onChange={(e) => setEdit({ ...edit, shipping: e.target.value })} /></label>
              <label className="fld">Other cost
                <input type="number" step="0.01" min="0" value={edit.other}
                  onChange={(e) => setEdit({ ...edit, other: e.target.value })} /></label>
              <label className="fld">Status
                <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="fld">Date
                <input type="date" value={edit.orderedAt}
                  onChange={(e) => setEdit({ ...edit, orderedAt: e.target.value })} /></label>
              <label className="fld grow">Notes
                <input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  placeholder="PO #, terms…" /></label>
            </div>

            {editEcon && (
              <div className="order-econ">
                <div><span>Revenue</span><strong>{usd(editEcon.revenue)}</strong></div>
                <div><span>COGS</span><strong>{usd(editEcon.cogs)}</strong></div>
                <div><span>Shipping</span><strong>{usd(editEcon.shipping)}</strong></div>
                <div><span>Other</span><strong>{usd(editEcon.other)}</strong></div>
                <div><span>Profit</span><strong className={editEcon.profit < 0 ? 'neg' : 'pos'}>{usd(editEcon.profit)}</strong></div>
                <div><span>Margin</span><strong>{pct(editEcon.marginPct)}</strong></div>
              </div>
            )}

            <div className="prod-form-actions">
              <button type="button" className="mini-btn" onClick={repriceEdit}>Reprice from product</button>
              <button type="button" className="ghost-btn" onClick={() => setEdit(null)}>Cancel</button>
              <button type="submit" className="solid-btn" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="admin-msg">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="admin-msg">No sales recorded yet. Use <strong>Record a sale</strong> above.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table compact orders-table">
              <thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Qty</th><th>Unit $</th>
                <th>Revenue</th><th>COGS</th><th>Ship</th><th>Other</th><th>Profit</th><th>Margin</th>
                <th>Status</th><th className="row-actions"></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={edit?.id === o.id ? 'row-editing' : undefined}>
                    <td className="muted">{o.orderedAt}</td>
                    <td>{o.customerName || '—'}</td>
                    <td className="muted">{o.productName || '—'}</td>
                    <td>{o.quantity.toLocaleString()}</td>
                    <td>{usd(o.unitPrice)}</td>
                    <td>{usd(o.econ.revenue)}</td>
                    <td className="muted">{usd(o.econ.cogs)}</td>
                    <td className="muted">{usd(o.econ.shipping)}</td>
                    <td className="muted">{usd(o.econ.other)}</td>
                    <td className={o.econ.profit < 0 ? 'neg' : undefined}>{usd(o.econ.profit)}</td>
                    <td>{pct(o.econ.marginPct)}</td>
                    <td>
                      <select value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)} className="status">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="row-actions">
                      <button className="mini-btn" onClick={() => startEdit(o)}>
                        {edit?.id === o.id ? 'Editing' : 'Edit'}</button>
                      <button className="link-danger" aria-label="Delete" onClick={() => remove(o.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
