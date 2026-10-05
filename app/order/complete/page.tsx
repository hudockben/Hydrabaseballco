import { stripe, stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order — Hydra Baseball Co.' };

/** Where Stripe's embedded checkout lands the customer once they've paid. */
export default async function OrderComplete({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let status: 'paid' | 'processing' | 'open' | 'unknown' = 'unknown';
  let email = '';
  if (session_id && stripeConfigured() && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try {
      const s = await stripe('GET', `/checkout/sessions/${session_id}`);
      email = s.customer_details?.email ?? '';
      status = s.status === 'open' ? 'open' : s.payment_status === 'paid' ? 'paid' : s.status === 'complete' ? 'processing' : 'unknown';
    } catch {
      status = 'unknown';
    }
  }

  const copy = {
    paid: ['Thanks — you’re all set.', `Your order is in.${email ? ` A receipt is on its way to ${email}.` : ''} We’ll email tracking as soon as it ships.`],
    processing: ['Thanks — payment is processing.', 'We’ll email you once your bank confirms it, then get your order out the door.'],
    open: ['Checkout wasn’t finished.', 'No payment was taken. Head back to the shop to pick up where you left off.'],
    unknown: ['We couldn’t find that order.', 'If you were charged, email info@hydrabaseballco.com and we’ll sort it out.'],
  }[status];

  return (
    <main className="orders" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <div className="container orders__inner">
        <span className="eyebrow eyebrow--red">Hydra Baseball Co.</span>
        <h1 className="section-title">{copy[0]}</h1>
        <p className="orders__lead">{copy[1]}</p>
        <p style={{ marginTop: 32 }}>
          <a href={status === 'open' ? '/#shop' : '/'} className="btn btn--dark">
            {status === 'open' ? 'Back to the shop' : 'Back to the site'}
          </a>
        </p>
      </div>
    </main>
  );
}
