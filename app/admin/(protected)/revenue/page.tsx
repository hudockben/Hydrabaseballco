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
  customerName: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  shippingCost: number;
  otherCost: number;
  status: string;
  orderedAt: string;
  econ: Econ;
}
interface Summary extends Econ {
  unitsSold: number;
  orderCount: number;
  byProduct: { name: string; units: number; revenue: number; profit: number; marginPct: number | null }[];
  byMonth: { month: string; revenue: number; profit: number; marginPct: number | null }[];
}
interface WonProspect { id: number; name: string }

const STATUSES = ['quote', 'confirmed', 'fulfilled', 'paid'];
const today = () => new Date().toISOString().slice(0, 10);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, wRes] = await Promise.all([
        fetch('/api/admin/orders'),
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const product = useMemo(() => products.find((p) => String(p.id) === productId) ?? null, [products, productId]);

  // Suggest unit price from the product's volume tiers + a shipping default,
  // unless the user has typed their own. Recompute when product/qty change.
  useEffect(() => {
    if (!product) return;
    setUnitCost(String(product.unitCost));
    const qty = Math.floor(n(quantity));
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

  function resetForm() {
    setProspectId(''); setProductId(''); setQuantity('100'); setUnitPrice(''); setUnitCost('');
    setShipping(''); setOther(''); setStatus('confirmed'); setOrderedAt(today()); setNotes('');
    setPriceTouched(false); setShipTouched(false);
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
        <div className="stat-grid fin-stats">
          <div className="stat stat--total"><span className="stat-n">{usd(summary.revenue)}</span><span className="stat-l">Revenue</span></div>
          <div className="stat"><span className={`stat-n ${summary.profit < 0 ? 'neg' : 'pos'}`}>{usd(summary.profit)}</span><span className="stat-l">Profit</span></div>
          <div className="stat"><span className="stat-n">{pct(summary.marginPct)}</span><span className="stat-l">Margin</span></div>
          <div className="stat"><span className="stat-n">{usd(summary.cogs)}</span><span className="stat-l">COGS</span></div>
          <div className="stat"><span className="stat-n">{usd(summary.shipping)}</span><span className="stat-l">Shipping</span></div>
          <div className="stat"><span className="stat-n">{summary.unitsSold.toLocaleString()}</span><span className="stat-l">Units sold</span></div>
          <div className="stat"><span className="stat-n">{summary.orderCount}</span><span className="stat-l">Orders</span></div>
        </div>
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
              <select value={productId} onChange={(e) => { setProductId(e.target.value); setPriceTouched(false); setShipTouched(false); }}>
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
              <input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="2.50" /></label>
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
        {loading ? (
          <p className="admin-msg">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="admin-msg">No sales recorded yet. Use <strong>Record a sale</strong> above.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Qty</th><th>Unit $</th>
                <th>Revenue</th><th>Profit</th><th>Margin</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="muted">{o.orderedAt}</td>
                    <td>{o.customerName || '—'}</td>
                    <td className="muted">{o.productName || '—'}</td>
                    <td>{o.quantity.toLocaleString()}</td>
                    <td>{usd(o.unitPrice)}</td>
                    <td>{usd(o.econ.revenue)}</td>
                    <td className={o.econ.profit < 0 ? 'neg' : undefined}>{usd(o.econ.profit)}</td>
                    <td>{pct(o.econ.marginPct)}</td>
                    <td>
                      <select value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)} className="status">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button className="link-danger" aria-label="Delete" onClick={() => remove(o.id)}>✕</button></td>
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
