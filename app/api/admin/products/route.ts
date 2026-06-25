import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import type { PriceTier, Product } from '@/lib/finance';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Normalize a client-supplied tier list: valid numbers, unique min_qty, sorted. */
function cleanTiers(input: unknown): PriceTier[] {
  if (!Array.isArray(input)) return [];
  const byMin = new Map<number, number>();
  for (const t of input) {
    const minQty = Math.max(1, Math.floor(num((t as PriceTier)?.minQty, 1)));
    const unitPrice = Math.max(0, num((t as PriceTier)?.unitPrice, 0));
    byMin.set(minQty, unitPrice); // last write wins for a duplicate min_qty
  }
  return [...byMin.entries()]
    .map(([minQty, unitPrice]) => ({ minQty, unitPrice }))
    .sort((a, b) => a.minQty - b.minQty);
}

async function loadProducts(): Promise<Product[]> {
  const sql = await db();
  const products = (await sql`select * from products order by active desc, name asc`) as Row[];
  const tiers = (await sql`select * from price_tiers order by min_qty asc`) as Row[];
  const byProduct = new Map<number, PriceTier[]>();
  for (const t of tiers) {
    const pid = Number(t.product_id);
    const arr = byProduct.get(pid) ?? [];
    arr.push({ id: Number(t.id), minQty: Number(t.min_qty), unitPrice: num(t.unit_price) });
    byProduct.set(pid, arr);
  }
  return products.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    sku: (p.sku as string) ?? null,
    unitCost: num(p.unit_cost),
    shipCost: num(p.ship_cost),
    active: Boolean(p.active),
    tiers: byProduct.get(Number(p.id)) ?? [],
  }));
}

async function replaceTiers(productId: number, tiers: PriceTier[]) {
  const sql = await db();
  await sql`delete from price_tiers where product_id = ${productId}`;
  for (const t of tiers) {
    await sql`
      insert into price_tiers (product_id, min_qty, unit_price)
      values (${productId}, ${t.minQty}, ${t.unitPrice})`;
  }
}

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ products: await loadProducts() });
  } catch (err) {
    console.error('products GET error', err);
    return NextResponse.json({ error: 'Database not connected — run db/schema.sql.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Product name is required.' }, { status: 400 });
  try {
    const sql = await db();
    const rows = (await sql`
      insert into products (name, sku, unit_cost, ship_cost, active)
      values (${name}, ${body.sku ? String(body.sku) : null}, ${num(body.unitCost)},
              ${num(body.shipCost)}, ${body.active === false ? false : true})
      returning id`) as Row[];
    const id = Number(rows[0].id);
    await replaceTiers(id, cleanTiers(body.tiers));
    return NextResponse.json({ id });
  } catch (err) {
    console.error('products POST error', err);
    return NextResponse.json({ error: 'Could not save the product.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = await db();
    const name = body.name != null ? String(body.name).trim() : null;
    const skuProvided = body.sku !== undefined;
    const skuVal = skuProvided ? String(body.sku).trim() || null : null;
    await sql`
      update products set
        name = coalesce(${name}, name),
        sku = case when ${skuProvided} then ${skuVal} else sku end,
        unit_cost = coalesce(${body.unitCost != null ? num(body.unitCost) : null}, unit_cost),
        ship_cost = coalesce(${body.shipCost != null ? num(body.shipCost) : null}, ship_cost),
        active = coalesce(${typeof body.active === 'boolean' ? body.active : null}, active),
        updated_at = now()
      where id = ${id}`;
    if (body.tiers !== undefined) await replaceTiers(id, cleanTiers(body.tiers));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('products PATCH error', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = await db();
    await sql`delete from products where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('products DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
