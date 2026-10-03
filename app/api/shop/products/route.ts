import { NextResponse } from 'next/server';
import { MAX_ONLINE_QTY } from '@/lib/shop';
import { loadShopProducts } from '@/lib/shop-server';
import { stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Public: the Stripe catalog the storefront sells, plus the key Stripe.js mounts with. */
export async function GET() {
  if (!stripeConfigured()) return NextResponse.json({ products: [] });
  try {
    return NextResponse.json({
      products: await loadShopProducts(),
      maxQty: MAX_ONLINE_QTY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error('shop products error', err);
    return NextResponse.json({ products: [] });
  }
}
