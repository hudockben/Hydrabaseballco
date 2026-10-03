import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhook } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe → Revenue tab. A paid checkout becomes an `orders` row (status
 * "paid") carrying the price and costs snapshotted when checkout started, so
 * online sales land in the same revenue, COGS and margin roll-ups as the deals
 * logged by hand. Keyed on the session id, so Stripe's retries never double-book.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get('stripe-signature'))) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  const event = JSON.parse(raw);
  const paidNow =
    (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') ||
    event.type === 'checkout.session.async_payment_succeeded';
  if (!paidNow) return NextResponse.json({ received: true });

  const s = event.data.object;
  const m = s.metadata ?? {};
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const customer = s.customer_details ?? {};
  const ship = s.shipping_details?.address ?? customer.address ?? {};
  const shipTo = [ship.line1, ship.line2, ship.city, ship.state, ship.postal_code].filter(Boolean).join(', ');
  const notes = [
    `Online order (Stripe ${s.id})`,
    customer.email,
    customer.phone,
    shipTo && `Ship to: ${s.shipping_details?.name ? `${s.shipping_details.name}, ` : ''}${shipTo}`,
  ]
    .filter(Boolean)
    .join(' · ');

  try {
    const sql = await db();
    await sql`
      insert into orders (product_id, customer_name, quantity, unit_price, unit_cost,
                          shipping_cost, shipping_charged, status, notes, stripe_session_id)
      select (select id from products where id = ${num(m.product_id)}), ${customer.name || customer.email || 'Online customer'},
             ${num(m.quantity)}, ${num(m.unit_price)}, ${num(m.unit_cost)},
             ${num(m.ship_cost)}, ${num(s.shipping_cost?.amount_total) / 100}, 'paid', ${notes}, ${s.id}
      where not exists (select 1 from orders where stripe_session_id = ${s.id})`;
  } catch (err: any) {
    if (err?.code === '23505') return NextResponse.json({ received: true }); // a concurrent retry won
    console.error('stripe webhook: could not record order', err);
    return NextResponse.json({ error: 'Could not record order' }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
