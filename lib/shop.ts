// The storefront's catalog is Stripe's: every active product in the Stripe
// dashboard with a one-time default price is for sale on the site, at that
// price. Volume pricing set on the price in Stripe applies as-is.

export interface ShopTier {
  upTo: number | null; // inclusive; null = no upper bound
  unitAmount: number; // cents per unit within this tier
  flatAmount: number; // cents added once when the tier applies
}

export interface ShopProduct {
  id: string; // Stripe product id
  priceId: string;
  name: string;
  description: string | null;
  image: string | null;
  currency: string;
  unitAmount: number | null; // cents; null when the price is tiered
  tiersMode: 'volume' | 'graduated' | null;
  tiers: ShopTier[];
  unitLabel: string; // what one unit of the Stripe price is, e.g. "dozen"
  ballsPerUnit: number; // balls in one unit, for the Revenue tab's per-ball numbers
}

/**
 * What one unit of a Stripe price buys. Balls sell by the dozen, so a product
 * with no "Unit label" in Stripe is a dozen. Set the label to "ball" (or
 * "bucket" with a balls_per_unit metadata value) to sell it differently.
 */
export function unitFor(label: string | null | undefined, ballsMeta?: string | null) {
  const unitLabel = (label || 'dozen').trim().toLowerCase();
  const fromMeta = Math.floor(Number(ballsMeta));
  const known: Record<string, number> = { dozen: 12, ball: 1, each: 1, baseball: 1 };
  const ballsPerUnit = fromMeta > 0 ? fromMeta : known[unitLabel] ?? 1;
  return { unitLabel, ballsPerUnit };
}

/** Largest single online order; anything bigger goes through Team Orders. */
export const MAX_ONLINE_QTY = 5000;

/** Total in cents for a quantity — the same maths Stripe applies at checkout. */
export function totalFor(p: Pick<ShopProduct, 'unitAmount' | 'tiersMode' | 'tiers'>, qty: number): number {
  if (p.unitAmount != null) return p.unitAmount * qty;
  if (p.tiersMode === 'volume') {
    const t = p.tiers.find((t) => t.upTo == null || qty <= t.upTo) ?? p.tiers[p.tiers.length - 1];
    return t ? t.unitAmount * qty + t.flatAmount : 0;
  }
  // graduated: each unit is priced by the tier it falls in
  let total = 0;
  let prev = 0;
  for (const t of p.tiers) {
    if (qty <= prev) break;
    const top = t.upTo == null ? qty : Math.min(qty, t.upTo);
    total += (top - prev) * t.unitAmount + t.flatAmount;
    prev = top;
  }
  return total;
}
