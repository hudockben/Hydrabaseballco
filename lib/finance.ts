// Money + margin math for the pricing / revenue tools. Pure functions only, so
// the same logic backs both the API (server) and the calculator UI (client).
//
// Convention: all amounts are plain numbers in dollars. "Landed unit cost" means
// per-unit COGS + per-unit shipping — the all-in cost of putting one ball in a
// customer's hands. Margin is gross margin: profit / revenue.

export interface PriceTier {
  id?: number;
  minQty: number; // tier applies to orders of this quantity or more
  unitPrice: number; // price per unit at this tier
}

export interface Product {
  id: number;
  name: string;
  sku?: string | null;
  unitCost: number; // COGS per unit
  shipCost: number; // default shipping per unit
  active: boolean;
  tiers: PriceTier[];
}

export interface OrderEconomics {
  revenue: number;
  cogs: number;
  shipping: number;
  other: number;
  profit: number;
  marginPct: number | null; // null when revenue is 0
}

/** Round to whole cents. Keeps display + sums free of float dust. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Unit price needed to hit a target gross margin, given the all-in unit cost.
 * margin is a percentage (0–100). Returns null for an impossible target (>=100%).
 */
export function priceForMargin(landedUnitCost: number, marginPct: number): number | null {
  if (!Number.isFinite(landedUnitCost) || !Number.isFinite(marginPct)) return null;
  if (marginPct >= 100) return null;
  return round2(landedUnitCost / (1 - marginPct / 100));
}

/** Gross margin % for a given price and all-in unit cost. Null if price <= 0. */
export function marginFromPrice(unitPrice: number, landedUnitCost: number): number | null {
  if (!(unitPrice > 0)) return null;
  return round2(((unitPrice - landedUnitCost) / unitPrice) * 100);
}

/** Markup % (profit over cost) for a given price and cost. Null if cost <= 0. */
export function markupFromPrice(unitPrice: number, landedUnitCost: number): number | null {
  if (!(landedUnitCost > 0)) return null;
  return round2(((unitPrice - landedUnitCost) / landedUnitCost) * 100);
}

/**
 * Resolve the per-unit price for a quantity from volume tiers: the price of the
 * highest tier whose minQty the quantity reaches. Null if no tier qualifies.
 */
export function priceForQty(tiers: PriceTier[], qty: number): number | null {
  let price: number | null = null;
  let bestMin = -1;
  for (const t of tiers) {
    if (qty >= t.minQty && t.minQty > bestMin) {
      bestMin = t.minQty;
      price = t.unitPrice;
    }
  }
  return price;
}

/** Full economics of one order line. `other` is any extra per-order cost. */
export function orderEconomics(args: {
  quantity: number;
  unitPrice: number;
  unitCost: number;
  shipping: number;
  other?: number;
}): OrderEconomics {
  const revenue = round2(args.quantity * args.unitPrice);
  const cogs = round2(args.quantity * args.unitCost);
  const shipping = round2(args.shipping || 0);
  const other = round2(args.other || 0);
  const profit = round2(revenue - cogs - shipping - other);
  const marginPct = revenue > 0 ? round2((profit / revenue) * 100) : null;
  return { revenue, cogs, shipping, other, profit, marginPct };
}

/** Sum a list of order economics into a single roll-up. */
export function sumEconomics(parts: OrderEconomics[]): OrderEconomics {
  const acc = parts.reduce(
    (a, p) => ({
      revenue: a.revenue + p.revenue,
      cogs: a.cogs + p.cogs,
      shipping: a.shipping + p.shipping,
      other: a.other + p.other,
      profit: a.profit + p.profit,
      marginPct: null,
    }),
    { revenue: 0, cogs: 0, shipping: 0, other: 0, profit: 0, marginPct: null as number | null },
  );
  acc.revenue = round2(acc.revenue);
  acc.cogs = round2(acc.cogs);
  acc.shipping = round2(acc.shipping);
  acc.other = round2(acc.other);
  acc.profit = round2(acc.profit);
  acc.marginPct = acc.revenue > 0 ? round2((acc.profit / acc.revenue) * 100) : null;
  return acc;
}

/** Format a number as USD for display. */
export function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Format a percentage (already in 0–100) for display. */
export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}
