import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { orderEconomics, sumEconomics, type OrderEconomics } from '@/lib/finance';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

interface OrderOut {
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
  econ: OrderEconomics;
}

function mapOrder(r: Row): OrderOut {
  const quantity = num(r.quantity);
  const unitPrice = num(r.unit_price);
  const unitCost = num(r.unit_cost);
  const shippingCost = num(r.shipping_cost);
  const otherCost = num(r.other_cost);
  return {
    id: Number(r.id),
    prospectId: r.prospect_id == null ? null : Number(r.prospect_id),
    productId: r.product_id == null ? null : Number(r.product_id),
    customerName: (r.customer_name as string) ?? (r.prospect_name as string) ?? null,
    productName: (r.product_name as string) ?? null,
    quantity,
    unitPrice,
    unitCost,
    shippingCost,
    otherCost,
    status: String(r.status ?? 'confirmed'),
    orderedAt: r.ordered_at instanceof Date ? r.ordered_at.toISOString().slice(0, 10) : String(r.ordered_at),
    notes: (r.notes as string) ?? null,
    econ: orderEconomics({ quantity, unitPrice, unitCost, shipping: shippingCost, other: otherCost }),
  };
}

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = getSql();
    const rows = (await sql`
      select o.*, p.name as product_name, pr.name as prospect_name
      from orders o
      left join products p on p.id = o.product_id
      left join prospects pr on pr.id = o.prospect_id
      order by o.ordered_at desc, o.id desc
      limit 2000`) as Row[];
    const orders = rows.map(mapOrder);

    const totals = sumEconomics(orders.map((o) => o.econ));
    const unitsSold = orders.reduce((s, o) => s + o.quantity, 0);

    // Break down by product and by month for quick read-outs.
    const byProductMap = new Map<string, { name: string; econ: OrderEconomics[]; units: number }>();
    const byMonthMap = new Map<string, OrderEconomics[]>();
    for (const o of orders) {
      const pk = o.productName ?? '— unassigned —';
      const pg = byProductMap.get(pk) ?? { name: pk, econ: [], units: 0 };
      pg.econ.push(o.econ);
      pg.units += o.quantity;
      byProductMap.set(pk, pg);

      const mk = o.orderedAt.slice(0, 7); // YYYY-MM
      const mg = byMonthMap.get(mk) ?? [];
      mg.push(o.econ);
      byMonthMap.set(mk, mg);
    }
    const byProduct = [...byProductMap.values()]
      .map((g) => ({ name: g.name, units: g.units, ...sumEconomics(g.econ) }))
      .sort((a, b) => b.revenue - a.revenue);
    const byMonth = [...byMonthMap.entries()]
      .map(([month, econ]) => ({ month, ...sumEconomics(econ) }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    return NextResponse.json({
      orders,
      summary: { ...totals, unitsSold, orderCount: orders.length, byProduct, byMonth },
    });
  } catch (err) {
    console.error('orders GET error', err);
    return NextResponse.json({ error: 'Database not connected — run db/schema.sql.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const quantity = Math.max(0, Math.floor(num(body.quantity)));
  if (!quantity) return NextResponse.json({ error: 'Enter a quantity.' }, { status: 400 });
  const status = ['quote', 'confirmed', 'fulfilled', 'paid'].includes(body.status) ? body.status : 'confirmed';
  try {
    const sql = getSql();
    const prospectId = body.prospectId ? Number(body.prospectId) : null;
    const productId = body.productId ? Number(body.productId) : null;

    // Snapshot cost / customer from their source records when not supplied, so a
    // saved order is self-contained even if the product or prospect changes later.
    let unitCost = body.unitCost != null ? num(body.unitCost) : null;
    if (unitCost == null && productId) {
      const p = (await sql`select unit_cost from products where id = ${productId}`) as Row[];
      unitCost = p.length ? num(p[0].unit_cost) : 0;
    }
    let customerName = body.customerName ? String(body.customerName).trim() : null;
    if (!customerName && prospectId) {
      const pr = (await sql`select name from prospects where id = ${prospectId}`) as Row[];
      customerName = pr.length ? String(pr[0].name) : null;
    }

    const rows = (await sql`
      insert into orders
        (prospect_id, product_id, customer_name, quantity, unit_price, unit_cost,
         shipping_cost, other_cost, status, ordered_at, notes)
      values
        (${prospectId}, ${productId}, ${customerName}, ${quantity}, ${num(body.unitPrice)},
         ${unitCost ?? 0}, ${num(body.shippingCost)}, ${num(body.otherCost)}, ${status},
         coalesce(${body.orderedAt ? String(body.orderedAt) : null}::date, current_date),
         ${body.notes ? String(body.notes) : null})
      returning id`) as Row[];
    return NextResponse.json({ id: Number(rows[0].id) });
  } catch (err) {
    console.error('orders POST error', err);
    return NextResponse.json({ error: 'Could not save the order.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = getSql();
    const status = ['quote', 'confirmed', 'fulfilled', 'paid'].includes(body.status) ? body.status : null;
    await sql`
      update orders set
        status = coalesce(${status}, status),
        quantity = coalesce(${body.quantity != null ? Math.floor(num(body.quantity)) : null}, quantity),
        unit_price = coalesce(${body.unitPrice != null ? num(body.unitPrice) : null}, unit_price),
        unit_cost = coalesce(${body.unitCost != null ? num(body.unitCost) : null}, unit_cost),
        shipping_cost = coalesce(${body.shippingCost != null ? num(body.shippingCost) : null}, shipping_cost),
        other_cost = coalesce(${body.otherCost != null ? num(body.otherCost) : null}, other_cost),
        notes = coalesce(${body.notes != null ? String(body.notes) : null}, notes),
        updated_at = now()
      where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('orders PATCH error', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = getSql();
    await sql`delete from orders where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('orders DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
