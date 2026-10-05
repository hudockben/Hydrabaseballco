import crypto from 'node:crypto';

// A thin Stripe client over the REST API — no SDK, so nothing new to install.
// The API version is pinned so a Stripe-side default change can't quietly
// alter the shape of a checkout session or a webhook payload.
const API = 'https://api.stripe.com/v1';
const API_VERSION = '2024-06-20';

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
}

type Params = Record<string, unknown>;

/** Flatten nested params into Stripe's form encoding: a[b][0][c]=v. */
function encode(params: Params, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') encode(item as Params, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      encode(v as Params, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

export async function stripe<T = Record<string, any>>(
  method: 'GET' | 'POST',
  path: string,
  params: Params = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  const body = encode(params).toString();
  const url = method === 'GET' && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': API_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? body : undefined,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data as T;
}

/**
 * Check a webhook's Stripe-Signature header against STRIPE_WEBHOOK_SECRET:
 * an HMAC-SHA256 of `${timestamp}.${rawBody}`, inside a five-minute window so a
 * captured request can't be replayed later.
 */
export function verifyWebhook(rawBody: string, header: string | null, toleranceSec = 300): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  let t = '';
  const sigs: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) sigs.push(v);
  }
  const ts = Number(t);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

/** Dollars to Stripe's integer cents. */
export const cents = (dollars: number): number => Math.round(dollars * 100);
