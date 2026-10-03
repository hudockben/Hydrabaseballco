import { NextRequest, NextResponse } from 'next/server';
import { priceForQty, round2 } from '@/lib/finance';
import { loadShopProducts, MAX_ONLINE_QTY } from '@/lib/shop';
import { cents, stripe, stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Start an embedded Stripe Checkout for one product at one quantity.
 *
 * The browser sends only the product id and quantity; the price is resolved
 * here from the Pricing tab's volume tiers, so nobody can check out at a price
 * they typed themselves.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Checkout is not set up yet.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const productId = Number(body.productId);
  const quantity = Math.floor(Number(body.quantity));
  if (!productId || !(quantity >= 1) || quantity > MAX_ONLINE_QTY) {
    return NextResponse.json({ error: `Pick a product and a quantity from 1 to ${MAX_ONLINE_QTY}.` }, { status: 400 });
  }

  try {
    const product = (await loadShopProducts()).find((p) => p.id === productId);
    const unitPrice = product ? priceForQty(product.tiers, quantity) : null;
    if (!product || unitPrice == null) {
      return NextResponse.json({ error: 'That product isn’t available at that quantity.' }, { status: 400 });
    }
    const shipping = round2(product.shipPerUnit * quantity);
    const origin = req.headers.get('origin') || new URL(req.url).origin;

    const session = await stripe('POST', '/checkout/sessions', {
      mode: 'payment',
      ui_mode: 'embedded',
      return_url: `${origin}/order/complete?session_id={CHECKOUT_SESSION_ID}`,
      line_items: [
        {
          quantity,
          price_data: {
            currency: 'usd',
            unit_amount: cents(unitPrice),
            product_data: { name: product.name, ...(product.sku ? { metadata: { sku: product.sku } } : {}) },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ['US'] },
      ...(shipping > 0
        ? {
            shipping_options: [
              {
                shipping_rate_data: {
                  type: 'fixed_amount',
                  display_name: 'Standard shipping',
                  fixed_amount: { amount: cents(shipping), currency: 'usd' },
                },
              },
            ],
          }
        : {}),
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      // Snapshotted for the webhook, which writes the Revenue-tab order.
      metadata: {
        product_id: String(product.id),
        quantity: String(quantity),
        unit_price: String(unitPrice),
        unit_cost: String(product.unitCost),
        ship_cost: String(shipping),
      },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('shop checkout error', err);
    return NextResponse.json({ error: 'Couldn’t start checkout. Try again in a moment.' }, { status: 500 });
  }
}
