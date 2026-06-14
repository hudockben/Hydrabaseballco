// Contact enrichment: given an org's website, fetch the homepage (and a
// linked "contact" page if needed) and pull a public email + phone number.
// Free, no API keys. Polite: one or two requests, short timeouts, real UA.

const UA = 'HydraProspector/1.0 (+https://hydrabaseballco.vercel.app)';
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !ct.includes('text') && !ct.includes('html')) return null;
    return (await res.text()).slice(0, 600_000);
  } catch {
    return null;
  }
}

function pickEmail(html: string): string | null {
  const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]));
  const candidates = mailtos.length ? mailtos : html.match(EMAIL_RE) ?? [];
  const cleaned = candidates
    .map((e) => e.trim().toLowerCase())
    .filter(
      (e) =>
        !/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(e) &&
        !/(example\.|sentry|wixpress|\.wix|@2x|@3x|godaddy|cloudflare)/i.test(e),
    );
  return cleaned[0] ?? null;
}

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return raw.trim();
}

function pickPhone(html: string): string | null {
  const tels = [...html.matchAll(/tel:([+\d().\-\s]{7,})/gi)].map((m) => m[1].trim());
  if (tels[0]) return normalizePhone(tels[0]);
  const text = html.replace(/<[^>]+>/g, ' ');
  const m = text.match(PHONE_RE);
  return m ? normalizePhone(m[0]) : null;
}

function contactLink(html: string, base: string): string | null {
  const re = /href\s*=\s*["']([^"']*contact[^"']*)["']/i;
  const m = html.match(re);
  if (!m) return null;
  try {
    return new URL(m[1], base).toString();
  } catch {
    return null;
  }
}

export interface Contact {
  email: string | null;
  phone: string | null;
}

export async function findContact(website: string): Promise<Contact> {
  const base = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const home = await fetchText(base);
  let email = home ? pickEmail(home) : null;
  let phone = home ? pickPhone(home) : null;

  if (home && (!email || !phone)) {
    const link = contactLink(home, base);
    if (link && link !== base) {
      const page = await fetchText(link);
      if (page) {
        email = email ?? pickEmail(page);
        phone = phone ?? pickPhone(page);
      }
    }
  }
  return { email, phone };
}
