import { NextRequest, NextResponse } from 'next/server';
import { MAX_ONLINE_QTY } from '@/lib/shop';
import { loadShippingRateIds, loadShopProducts } from '@/lib/shop-server';
import { stripe, stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Start an embedded Stripe Checkout for one product at one quantity. The line
 * item references the product's Stripe price, so Stripe does the charging maths
 * and nobody can check out at a price they typed themselves.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Checkout is not set up yet.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const productId = String(body.productId ?? '');
  const quantity = Math.floor(Number(body.quantity));
  if (!productId || !(quantity >= 1) || quantity > MAX_ONLINE_QTY) {
    return NextResponse.json({ error: `Pick a product and a quantity from 1 to ${MAX_ONLINE_QTY}.` }, { status: 400 });
  }

  try {
    const [products, shippingRates] = await Promise.all([loadShopProducts(), loadShippingRateIds()]);
    const product = products.find((p) => p.id === productId);
    if (!product) return NextResponse.json({ error: 'That product isn’t available.' }, { status: 400 });
    const origin = req.headers.get('origin') || new URL(req.url).origin;

    const session = await stripe('POST', '/checkout/sessions', {
      mode: 'payment',
      ui_mode: 'embedded',
      return_url: `${origin}/order/complete?session_id={CHECKOUT_SESSION_ID}`,
      line_items: [{ price: product.priceId, quantity }],
      shipping_address_collection: { allowed_countries: ['US'] },
      ...(shippingRates.length ? { shipping_options: shippingRates.map((id) => ({ shipping_rate: id })) } : {}),
      phone_number_collection: { enabled: true },
      // Read back by the webhook, which writes the Revenue-tab order.
      metadata: { product_name: product.name, quantity: String(quantity) },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('shop checkout error', err);
    return NextResponse.json({ error: 'Couldn’t start checkout. Try again in a moment.' }, { status: 500 });
  }
}
