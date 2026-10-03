import { stripe } from '@/lib/stripe';
import { unitFor, type ShopProduct } from '@/lib/shop';

// Server-only: reads the storefront's catalog from Stripe. Kept apart from
// lib/shop.ts so the browser bundle never pulls in the secret-key client.

export async function loadShopProducts(): Promise<ShopProduct[]> {
  const res = await stripe('GET', '/products', {
    active: true,
    limit: 100,
    expand: ['data.default_price', 'data.default_price.tiers'],
  });
  const out: ShopProduct[] = [];
  for (const p of res.data ?? []) {
    const price = p.default_price;
    if (!price || typeof price !== 'object' || !price.active || price.type !== 'one_time') continue;
    const tiered = price.billing_scheme === 'tiered';
    if (!tiered && !(price.unit_amount > 0)) continue; // free / customer-chooses prices aren't sellable here
    out.push({
      id: p.id,
      priceId: price.id,
      name: p.name,
      description: p.description ?? null,
      image: p.images?.[0] ?? null,
      currency: price.currency,
      unitAmount: tiered ? null : price.unit_amount,
      tiersMode: tiered ? price.tiers_mode : null,
      tiers: tiered
        ? (price.tiers ?? []).map((t: any) => ({
            upTo: t.up_to ?? null,
            unitAmount: Number(t.unit_amount ?? 0),
            flatAmount: Number(t.flat_amount ?? 0),
          }))
        : [],
      ...unitFor(p.unit_label, p.metadata?.balls_per_unit),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Active shipping rates from Stripe (Product catalog → Shipping rates), max 5. */
export async function loadShippingRateIds(): Promise<string[]> {
  try {
    const res = await stripe('GET', '/shipping_rates', { active: true, limit: 5 });
    return (res.data ?? []).map((r: any) => r.id);
  } catch (err) {
    console.error('shop: could not load shipping rates', err);
    return [];
  }
}
