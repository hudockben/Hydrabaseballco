import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { orderEconomics, round2, sumEconomics, type OrderEconomics } from '@/lib/finance';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

const STATUSES = ['quote', 'confirmed', 'fulfilled', 'paid'];

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
  shippingCharged: number;
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
  const shippingCharged = num(r.shipping_charged);
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
    shippingCharged,
    otherCost,
    status: String(r.status ?? 'confirmed'),
    orderedAt: r.ordered_at instanceof Date ? r.ordered_at.toISOString().slice(0, 10) : String(r.ordered_at),
    notes: (r.notes as string) ?? null,
    econ: orderEconomics({
      quantity, unitPrice, unitCost, shipping: shippingCost, shippingCharged, other: otherCost,
    }),
  };
}

/**
 * Which statuses roll into the headline totals. A quote is not money in the
 * door, so counting one as booked revenue overstates the business — but which
 * line is "real" depends on how you run the books, hence the choice.
 */
const COUNTING: Record<string, string[] | null> = {
  all: null, // every order, quotes included
  booked: ['confirmed', 'fulfilled', 'paid'],
  paid: ['paid'],
};

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const param = new URL(req.url).searchParams.get('counting') ?? 'all';
  const counting = Object.prototype.hasOwnProperty.call(COUNTING, param) ? param : 'all';
  const countedStatuses = COUNTING[counting];
  try {
    const sql = await db();
    const rows = (await sql`
      select o.*, p.name as product_name, pr.name as prospect_name
      from orders o
      left join products p on p.id = o.product_id
      left join prospects pr on pr.id = o.prospect_id
      order by o.ordered_at desc, o.id desc
      limit 2000`) as Row[];
    const orders = rows.map(mapOrder);

    // The table always lists every order; only the roll-ups respect `counting`.
    const counted = countedStatuses ? orders.filter((o) => countedStatuses.includes(o.status)) : orders;
    const totals = sumEconomics(counted.map((o) => o.econ));
    const unitsSold = counted.reduce((s, o) => s + o.quantity, 0);

    // Break down by product and by month for quick read-outs.
    const byProductMap = new Map<string, { name: string; econ: OrderEconomics[]; units: number }>();
    const byMonthMap = new Map<string, OrderEconomics[]>();
    for (const o of counted) {
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
      summary: {
        ...totals,
        unitsSold,
        orderCount: counted.length,
        counting,
        excludedCount: orders.length - counted.length,
        byProduct,
        byMonth,
      },
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
  const status = STATUSES.includes(body.status) ? body.status : 'confirmed';
  try {
    const sql = await db();
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
         shipping_cost, shipping_charged, other_cost, status, ordered_at, notes)
      values
        (${prospectId}, ${productId}, ${customerName}, ${quantity}, ${num(body.unitPrice)},
         ${unitCost ?? 0}, ${num(body.shippingCost)}, ${num(body.shippingCharged)},
         ${num(body.otherCost)}, ${status},
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

  // Every field is optional and independent: the status dropdown patches
  // `status` alone, the edit form sends the whole order. Each column is written
  // only when its key is present, so an omitted field keeps its stored value
  // while an explicit `null` clears a nullable one — a distinction `coalesce`
  // can't make, which is why the writes below are `case when <sent> then …`.
  const sent = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const money = (v: unknown) => Math.max(0, round2(num(v)));
  const idOrNull = (v: unknown) => (v == null || v === '' ? null : Number(v) || null);
  const textOrNull = (v: unknown) => {
    const s = v == null ? '' : String(v).trim();
    return s ? s : null;
  };

  if (sent('status') && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }
  const quantity = sent('quantity') ? Math.max(0, Math.floor(num(body.quantity))) : 0;
  if (sent('quantity') && !quantity) return NextResponse.json({ error: 'Enter a quantity.' }, { status: 400 });
  const orderedAt = sent('orderedAt') ? String(body.orderedAt ?? '') : '';
  if (sent('orderedAt') && !/^\d{4}-\d{2}-\d{2}$/.test(orderedAt)) {
    return NextResponse.json({ error: 'Enter the date as YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const sql = await db();
    const rows = (await sql`
      update orders o set
        status        = case when ${sent('status')}::boolean      then ${body.status ?? null}::text        else o.status end,
        quantity      = case when ${sent('quantity')}::boolean    then ${quantity}::int                    else o.quantity end,
        unit_price    = case when ${sent('unitPrice')}::boolean   then ${money(body.unitPrice)}::numeric   else o.unit_price end,
        unit_cost     = case when ${sent('unitCost')}::boolean    then ${money(body.unitCost)}::numeric    else o.unit_cost end,
        shipping_cost = case when ${sent('shippingCost')}::boolean then ${money(body.shippingCost)}::numeric else o.shipping_cost end,
        shipping_charged = case when ${sent('shippingCharged')}::boolean then ${money(body.shippingCharged)}::numeric else o.shipping_charged end,
        other_cost    = case when ${sent('otherCost')}::boolean   then ${money(body.otherCost)}::numeric   else o.other_cost end,
        customer_name = case when ${sent('customerName')}::boolean then ${textOrNull(body.customerName)}::text else o.customer_name end,
        notes         = case when ${sent('notes')}::boolean       then ${textOrNull(body.notes)}::text     else o.notes end,
        product_id    = case when ${sent('productId')}::boolean   then ${idOrNull(body.productId)}::bigint else o.product_id end,
        prospect_id   = case when ${sent('prospectId')}::boolean  then ${idOrNull(body.prospectId)}::bigint else o.prospect_id end,
        ordered_at    = case when ${sent('orderedAt')}::boolean   then ${orderedAt || null}::date          else o.ordered_at end,
        updated_at    = now()
      where o.id = ${id}
      returning o.*,
        (select name from products where id = o.product_id)  as product_name,
        (select name from prospects where id = o.prospect_id) as prospect_name`) as Row[];
    if (!rows.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, order: mapOrder(rows[0]) });
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
    const sql = await db();
    await sql`delete from orders where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('orders DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
