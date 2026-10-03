'use client';

import { useEffect, useRef, useState } from 'react';
import { totalFor, type ShopProduct } from '@/lib/shop';

const money = (cents: number, currency = 'usd') =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() });

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
 * "Buy Now": the active products in the Stripe dashboard, at their Stripe
 * prices, paid through Stripe's checkout embedded in the page. Renders only
 * its #shop anchor until Stripe keys are set and a product exists in Stripe,
 * so the section can ship before the store is ready to open.
 */
export default function Shop() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [maxQty, setMaxQty] = useState(5000);
  const [pk, setPk] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
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

  // Until the store opens, leave just the anchor: it sits right above Team
  // Orders, so the header's Shop links land on the inquiry form, not nowhere.
  if (!pk || products.length === 0) return <span id="shop" aria-hidden="true" />;

  const product = products.find((p) => p.id === productId) ?? products[0];
  const quantity = Math.floor(Number(qty));
  const validQty = quantity >= 1 && quantity <= maxQty;
  const subtotal = validQty ? totalFor(product, quantity) : null;
  const priceLabel =
    product.unitAmount != null
      ? `${money(product.unitAmount, product.currency)} / ${product.unitLabel}`
      : `Volume pricing — the more you buy, the less each ${product.unitLabel} costs`;
  const plural = (n: number, w: string) => (n === 1 ? w : w === 'dozen' ? 'dozen' : `${w}s`);

  async function startCheckout() {
    if (!validQty) return;
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
                <select value={product.id} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="shop__field">
                <span>Quantity ({plural(2, product.unitLabel)})</span>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
            </div>

            {product.description && <p className="shop__desc">{product.description}</p>}
            <p className="shop__price">{priceLabel}</p>
            {product.tiers.length > 0 && (
              <ul className="shop__tiers" aria-label="Volume pricing">
                {product.tiers.map((t, i) => {
                  const from = i === 0 ? 1 : (product.tiers[i - 1].upTo ?? 0) + 1;
                  const active = validQty && quantity >= from && (t.upTo == null || quantity <= t.upTo);
                  return (
                    <li key={i} className={active ? 'is-active' : undefined}>
                      <span>{t.upTo == null ? `${from}+` : `${from}–${t.upTo}`}</span>
                      <strong>{money(t.unitAmount, product.currency)}</strong>
                      <span>/ {product.unitLabel}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {validQty && product.ballsPerUnit > 1 && (
              <p className="shop__desc">
                {quantity} {plural(quantity, product.unitLabel)} = {quantity * product.ballsPerUnit} balls
              </p>
            )}

            <dl className="shop__totals">
              <div className="shop__total">
                <dt>Subtotal</dt>
                <dd>{subtotal != null ? money(subtotal, product.currency) : '—'}</dd>
              </div>
            </dl>

            {!validQty && <p className="shop__msg">Enter a quantity from 1 to {maxQty}.</p>}
            {err && <p className="shop__msg">{err}</p>}

            <button type="button" className="btn btn--dark" onClick={startCheckout} disabled={busy || !validQty}>
              {busy ? 'Loading checkout…' : 'Checkout'}
            </button>
            <p className="shop__secure">Shipping is added at checkout. Secure payment by Stripe; ships within the US.</p>
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
