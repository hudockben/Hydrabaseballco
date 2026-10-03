import { db } from '@/lib/db';
import type { PriceTier } from '@/lib/finance';

// What the public storefront sees: products flagged "Sell online" in the admin
// Pricing tab, with their volume tiers. Cost fields stay server-side — the
// checkout route reads them for the order record, the browser never does.
export interface ShopProduct {
  id: number;
  name: string;
  sku: string | null;
  shipPerUnit: number; // shipping billed per ball at checkout
  tiers: PriceTier[];
}

export interface ShopProductWithCost extends ShopProduct {
  unitCost: number;
}

type Row = Record<string, unknown>;

export async function loadShopProducts(): Promise<ShopProductWithCost[]> {
  const sql = await db();
  const products = (await sql`
    select * from products where active and sell_online order by name asc`) as Row[];
  if (products.length === 0) return [];
  const tiers = (await sql`select * from price_tiers order by min_qty asc`) as Row[];
  const byProduct = new Map<number, PriceTier[]>();
  for (const t of tiers) {
    const pid = Number(t.product_id);
    const arr = byProduct.get(pid) ?? [];
    arr.push({ minQty: Number(t.min_qty), unitPrice: Number(t.unit_price) });
    byProduct.set(pid, arr);
  }
  return products
    .map((p) => ({
      id: Number(p.id),
      name: String(p.name),
      sku: (p.sku as string) ?? null,
      shipPerUnit: Number(p.ship_cost) || 0,
      unitCost: Number(p.unit_cost) || 0,
      tiers: (byProduct.get(Number(p.id)) ?? []).filter((t) => t.unitPrice > 0),
    }))
    .filter((p) => p.tiers.length > 0); // nothing to charge without a price
}

/** Largest single online order; anything bigger goes through Team Orders. */
export const MAX_ONLINE_QTY = 5000;
