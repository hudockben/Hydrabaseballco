'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  marginFromPrice,
  markupFromPrice,
  pct,
  priceForMargin,
  round2,
  usd,
  type PriceTier,
  type Product,
} from '@/lib/finance';

const n = (v: string): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

interface TierDraft {
  minQty: string;
  unitPrice: string;
}
interface Draft {
  id?: number;
  name: string;
  sku: string;
  unitCost: string;
  shipCost: string;
  active: boolean;
  tiers: TierDraft[];
}

const emptyDraft = (): Draft => ({
  name: '',
  sku: '',
  unitCost: '',
  shipCost: '',
  active: true,
  tiers: [{ minQty: '1', unitPrice: '' }],
});

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // Calculator
  const [calcId, setCalcId] = useState<number | 'custom'>('custom');
  const [calcCost, setCalcCost] = useState('');
  const [calcShip, setCalcShip] = useState('');
  const [targetMargin, setTargetMargin] = useState('40');
  const [checkPrice, setCheckPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to load.');
        return;
      }
      setErr('');
      setProducts(data.products);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const calcProduct = useMemo(
    () => (calcId === 'custom' ? null : products.find((p) => p.id === calcId) ?? null),
    [calcId, products],
  );

  // When a product is chosen in the calculator, seed its costs.
  useEffect(() => {
    if (calcProduct) {
      setCalcCost(String(calcProduct.unitCost));
      setCalcShip(String(calcProduct.shipCost));
    }
  }, [calcProduct]);

  const landed = round2(n(calcCost) + n(calcShip));
  const suggested = priceForMargin(landed, n(targetMargin));
  const checkMargin = marginFromPrice(n(checkPrice), landed);
  const checkMarkup = markupFromPrice(n(checkPrice), landed);
  const checkProfit = checkPrice ? round2(n(checkPrice) - landed) : null;

  async function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) {
      setMsg('Give the product a name.');
      return;
    }
    setSaving(true);
    setMsg('');
    const payload = {
      id: draft.id,
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      unitCost: n(draft.unitCost),
      shipCost: n(draft.shipCost),
      active: draft.active,
      tiers: draft.tiers
        .filter((t) => t.minQty !== '' && t.unitPrice !== '')
        .map((t) => ({ minQty: Math.max(1, Math.floor(n(t.minQty))), unitPrice: n(t.unitPrice) })),
    };
    try {
      const res = await fetch('/api/admin/products', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Save failed.');
        return;
      }
      setDraft(null);
      setMsg(draft.id ? 'Product updated.' : 'Product added.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: number) {
    if (!confirm('Delete this product? Orders keep their snapshotted costs.')) return;
    setProducts((ps) => ps.filter((p) => p.id !== id));
    await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
    await load();
  }

  function startEdit(p: Product) {
    setMsg('');
    setDraft({
      id: p.id,
      name: p.name,
      sku: p.sku ?? '',
      unitCost: String(p.unitCost),
      shipCost: String(p.shipCost),
      active: p.active,
      tiers: p.tiers.length
        ? p.tiers.map((t) => ({ minQty: String(t.minQty), unitPrice: String(t.unitPrice) }))
        : [{ minQty: '1', unitPrice: '' }],
    });
  }

  const tierMargin = (t: PriceTier) => marginFromPrice(t.unitPrice, landed);

  return (
    <div>
      <h1 className="admin-h1">Pricing &amp; Margins</h1>

      {err && <div className="admin-callout"><strong>Database not connected.</strong>
        <p>Run <code>db/migrations/2026-06-14-add-finance.sql</code> in your Neon SQL editor, then refresh.</p>
      </div>}
      {msg && <p className="admin-msg">{msg}</p>}

      {/* ---------- Calculator ---------- */}
      <section className="fin-card">
        <h2 className="fin-h2">Pricing calculator</h2>
        <div className="calc-grid">
          <label className="fld">
            From product
            <select
              value={String(calcId)}
              onChange={(e) => setCalcId(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
            >
              <option value="custom">Custom / ad-hoc</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="fld">
            Unit cost (COGS)
            <input type="number" step="0.01" min="0" value={calcCost}
              onChange={(e) => { setCalcId('custom'); setCalcCost(e.target.value); }} placeholder="2.50" />
          </label>
          <label className="fld">
            Shipping / unit
            <input type="number" step="0.01" min="0" value={calcShip}
              onChange={(e) => { setCalcId('custom'); setCalcShip(e.target.value); }} placeholder="0.75" />
          </label>
          <div className="fld">
            <span>Landed unit cost</span>
            <div className="calc-readout">{usd(landed)}</div>
          </div>
        </div>

        <div className="calc-two">
          <div className="calc-panel">
            <h3>Set a price for a target margin</h3>
            <label className="fld inline">
              Target margin
              <span className="suffix"><input type="number" step="1" value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)} /> %</span>
            </label>
            <div className="calc-out">
              <div><span>Sell at</span><strong className="big">{usd(suggested)}</strong></div>
              <div><span>Profit / unit</span><strong>{suggested != null ? usd(round2(suggested - landed)) : '—'}</strong></div>
            </div>
          </div>

          <div className="calc-panel">
            <h3>Check a price</h3>
            <label className="fld inline">
              Your price
              <span className="suffix">$ <input type="number" step="0.01" min="0" value={checkPrice}
                onChange={(e) => setCheckPrice(e.target.value)} placeholder="4.50" /></span>
            </label>
            <div className="calc-out">
              <div><span>Margin</span><strong className="big">{pct(checkMargin)}</strong></div>
              <div><span>Markup</span><strong>{pct(checkMarkup)}</strong></div>
              <div><span>Profit / unit</span><strong>{checkProfit != null ? usd(checkProfit) : '—'}</strong></div>
            </div>
          </div>
        </div>

        {calcProduct && calcProduct.tiers.length > 0 && (
          <div className="tier-preview">
            <h3>Volume tiers — {calcProduct.name}</h3>
            <table className="data-table compact">
              <thead><tr><th>Min qty</th><th>Unit price</th><th>Profit / unit</th><th>Margin</th></tr></thead>
              <tbody>
                {calcProduct.tiers.map((t) => (
                  <tr key={t.minQty}>
                    <td>{t.minQty}+</td>
                    <td>{usd(t.unitPrice)}</td>
                    <td>{usd(round2(t.unitPrice - landed))}</td>
                    <td className={tierMargin(t) != null && tierMargin(t)! < 0 ? 'neg' : undefined}>{pct(tierMargin(t))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Products ---------- */}
      <section className="fin-card">
        <div className="fin-card-head">
          <h2 className="fin-h2">Products &amp; costs</h2>
          {!draft && <button className="mini-btn" onClick={() => { setMsg(''); setDraft(emptyDraft()); }}>+ Add product</button>}
        </div>

        {draft && (
          <form className="prod-form" onSubmit={saveDraft}>
            <div className="prod-grid">
              <label className="fld">Name<input value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Hydra Prime — Competition" /></label>
              <label className="fld">SKU (optional)<input value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="HP-COMP" /></label>
              <label className="fld">Unit cost (COGS)<input type="number" step="0.01" min="0" value={draft.unitCost}
                onChange={(e) => setDraft({ ...draft, unitCost: e.target.value })} placeholder="2.50" /></label>
              <label className="fld">Shipping / unit<input type="number" step="0.01" min="0" value={draft.shipCost}
                onChange={(e) => setDraft({ ...draft, shipCost: e.target.value })} placeholder="0.75" /></label>
            </div>

            <div className="tier-editor">
              <div className="tier-editor-head"><span>Volume price tiers</span>
                <button type="button" className="mini-btn" onClick={() =>
                  setDraft({ ...draft, tiers: [...draft.tiers, { minQty: '', unitPrice: '' }] })}>+ Tier</button>
              </div>
              {draft.tiers.map((t, i) => (
                <div className="tier-row" key={i}>
                  <label>Min qty<input type="number" min="1" value={t.minQty} placeholder="1"
                    onChange={(e) => { const tiers = [...draft.tiers]; tiers[i] = { ...t, minQty: e.target.value }; setDraft({ ...draft, tiers }); }} /></label>
                  <label>Unit price<input type="number" step="0.01" min="0" value={t.unitPrice} placeholder="4.50"
                    onChange={(e) => { const tiers = [...draft.tiers]; tiers[i] = { ...t, unitPrice: e.target.value }; setDraft({ ...draft, tiers }); }} /></label>
                  <button type="button" className="link-danger" aria-label="Remove tier"
                    onClick={() => setDraft({ ...draft, tiers: draft.tiers.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>

            <div className="prod-form-actions">
              <label className="chk"><input type="checkbox" checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
              <button type="button" className="ghost-btn" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="solid-btn" disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add product'}</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="admin-msg">Loading…</p>
        ) : products.length === 0 ? (
          !draft && <p className="admin-msg">No products yet. Add one to start pricing.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Unit cost</th><th>Ship/unit</th><th>Tiers</th><th></th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className={p.active ? undefined : 'row-saved'}>
                    <td>{p.name}{!p.active && <span className="muted"> (inactive)</span>}</td>
                    <td className="muted">{p.sku || '—'}</td>
                    <td>{usd(p.unitCost)}</td>
                    <td>{usd(p.shipCost)}</td>
                    <td className="muted">{p.tiers.length ? p.tiers.map((t) => `${t.minQty}+ ${usd(t.unitPrice)}`).join(' · ') : '—'}</td>
                    <td className="row-actions">
                      <button className="mini-btn" onClick={() => startEdit(p)}>Edit</button>
                      <button className="link-danger" aria-label="Delete" onClick={() => removeProduct(p.id)}>✕</button>
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
