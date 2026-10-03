import { NextResponse } from 'next/server';
import { loadShopProducts, MAX_ONLINE_QTY, type ShopProduct } from '@/lib/shop';
import { stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Public: what the storefront can sell, plus the key Stripe.js mounts with. */
export async function GET() {
  if (!stripeConfigured()) return NextResponse.json({ products: [] });
  try {
    const products: ShopProduct[] = (await loadShopProducts()).map(({ unitCost: _cost, ...p }) => p);
    return NextResponse.json({
      products,
      maxQty: MAX_ONLINE_QTY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error('shop products error', err);
    return NextResponse.json({ products: [] });
  }
}
