'use client';

import { useEffect, useRef, useState } from 'react';
import { priceForQty, round2, usd, type PriceTier } from '@/lib/finance';

interface ShopProduct {
  id: number;
  name: string;
  sku: string | null;
  shipPerUnit: number;
  tiers: PriceTier[];
}

interface EmbeddedCheckout {
  mount(el: HTMLElement): void;
  destroy(): void;
}
declare global {
  interface Window {
    Stripe?: (key: string) => {
      initEmbeddedCheckout(opts: { fetchClientSecret: () => Promise<string> }): Promise<EmbeddedCheckout>;
    };
  }
}

/** Stripe.js must be loaded from js.stripe.com itself (PCI), once per page. */
let stripeJs: Promise<void> | null = null;
function loadStripeJs(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  if (!stripeJs) {
    stripeJs = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => resolve();
      s.onerror = () => {
        stripeJs = null;
        reject(new Error('Stripe.js failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return stripeJs;
}

/**
 * "Buy Now": the products flagged Sell online in the admin Pricing tab, priced
 * by their volume tiers, paid through Stripe's checkout embedded in the page.
 * Renders nothing until Stripe keys are set and at least one product is listed,
 * so the section can ship before the store is ready to open.
 */
export default function Shop() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [maxQty, setMaxQty] = useState(5000);
  const [pk, setPk] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [qty, setQty] = useState('12');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<EmbeddedCheckout | null>(null);

  useEffect(() => {
    fetch('/api/shop/products')
      .then((r) => r.json())
      .then((d) => {
        const list: ShopProduct[] = d.products ?? [];
        setProducts(list);
        setPk(d.publishableKey ?? '');
        if (d.maxQty) setMaxQty(d.maxQty);
        if (list.length) setProductId(list[0].id);
      })
      .catch(() => {});
    return () => checkoutRef.current?.destroy();
  }, []);

  if (!pk || products.length === 0) return null;

  const product = products.find((p) => p.id === productId) ?? products[0];
  const quantity = Math.floor(Number(qty));
  const validQty = quantity >= 1 && quantity <= maxQty;
  const unit = validQty ? priceForQty(product.tiers, quantity) : null;
  const subtotal = unit != null ? round2(unit * quantity) : null;
  const shipping = validQty ? round2(product.shipPerUnit * quantity) : null;
  const minQty = Math.min(...product.tiers.map((t) => t.minQty));

  async function startCheckout() {
    if (unit == null) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) throw new Error(data.error || 'Couldn’t start checkout.');
      await loadStripeJs();
      checkoutRef.current?.destroy();
      const checkout = await window.Stripe!(pk).initEmbeddedCheckout({
        fetchClientSecret: async () => data.clientSecret,
      });
      checkoutRef.current = checkout;
      setCheckingOut(true);
      // Mount after React has shown the container.
      requestAnimationFrame(() => mountRef.current && checkout.mount(mountRef.current));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t start checkout.');
    } finally {
      setBusy(false);
    }
  }

  function changeOrder() {
    checkoutRef.current?.destroy();
    checkoutRef.current = null;
    setCheckingOut(false);
  }

  return (
    <section className="shop" id="shop">
      <div className="container shop__inner">
        <span className="eyebrow eyebrow--red">Shop</span>
        <h2 className="section-title">Buy Baseballs</h2>
        <p className="shop__lead">
          Order stock A1492 balls by the dozen or by the bucket &mdash; the more you buy, the less each ball costs.
          Custom logo runs go through <a href="#team-orders">Team Orders</a>.
        </p>

        {!checkingOut ? (
          <div className="shop__card">
            <div className="shop__fields">
              <label className="shop__field">
                <span>Ball</span>
                <select value={product.id} onChange={(e) => setProductId(Number(e.target.value))}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="shop__field">
                <span>Quantity</span>
                <input
                  type="number"
                  min={minQty}
                  max={maxQty}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
            </div>

            <ul className="shop__tiers" aria-label="Volume pricing">
              {product.tiers.map((t) => (
                <li key={t.minQty} className={unit === t.unitPrice && quantity >= t.minQty ? 'is-active' : undefined}>
                  <span>{t.minQty}+</span>
                  <strong>{usd(t.unitPrice)}</strong>
                  <span>/ ball</span>
                </li>
              ))}
            </ul>

            <dl className="shop__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{subtotal != null ? usd(subtotal) : '—'}</dd>
              </div>
              {product.shipPerUnit > 0 && (
                <div>
                  <dt>Shipping</dt>
                  <dd>{shipping != null && unit != null ? usd(shipping) : '—'}</dd>
                </div>
              )}
              <div className="shop__total">
                <dt>Total</dt>
                <dd>{subtotal != null ? usd(round2(subtotal + (shipping ?? 0))) : '—'}</dd>
              </div>
            </dl>

            {!validQty && <p className="shop__msg">Enter a quantity from 1 to {maxQty}.</p>}
            {validQty && unit == null && <p className="shop__msg">Minimum order is {minQty} balls.</p>}
            {err && <p className="shop__msg">{err}</p>}

            <button type="button" className="btn btn--dark" onClick={startCheckout} disabled={busy || unit == null}>
              {busy ? 'Loading checkout…' : 'Checkout'}
            </button>
            <p className="shop__secure">Secure payment by Stripe. Ships within the US.</p>
          </div>
        ) : (
          <div className="shop__checkout">
            <button type="button" className="shop__back" onClick={changeOrder}>
              ← Change order
            </button>
            <div ref={mountRef} />
          </div>
        )}
      </div>
    </section>
  );
}
