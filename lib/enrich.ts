// Contact enrichment: given an org's website, fetch the homepage (and a
// linked "contact" page if needed) and pull a public email + phone number.
// Free, no API keys. Polite: one or two requests, short timeouts, real UA.

const UA = 'HydraProspector/1.0 (+https://hydrabaseballco.vercel.app)';
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Valid US/NANP numbers: area code and exchange start 2-9 (rejects junk like "084").
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}/g;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(6500),
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

// Score links by how likely they lead to a coach/contact, so we can crawl
// homepage -> athletics -> baseball/softball -> coaches.
const LINK_SCORES: Array<[RegExp, number]> = [
  [/baseball/i, 6],
  [/softball/i, 6],
  [/coach/i, 5],
  [/staff[\s_-]*director|staff|roster|personnel/i, 4],
  [/athletic/i, 3],
  [/contact/i, 2],
  [/about|team|directory/i, 1],
];

function candidateLinks(html: string, base: string): string[] {
  const re = /<a[^>]+href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const scored: Array<{ url: string; score: number }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    const hay = `${href} ${text}`;
    let score = 0;
    for (const [rx, s] of LINK_SCORES) if (rx.test(hay)) score = Math.max(score, s);
    if (!score) continue;
    let url: string;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    scored.push({ url, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 5).map((x) => x.url);
}

// Best-effort: find a contact person's name near a coach/AD/director label.
const NAME = '([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)';
const COACH_ROLE =
  'head\\s+(?:baseball|softball)\\s+coach|head\\s+coach|baseball\\s+coach|softball\\s+coach|associate\\s+head\\s+coach|assistant\\s+coach';
const CONTACT_ROLE = 'athletic\\s+director|director\\s+of\\s+athletics|general\\s+manager|owner|president';

// Words that are not first/last names — guards against "Our History",
// "Athletic Department", "Of The", etc. matching the name pattern.
const NAME_STOP = new Set([
  'the', 'of', 'our', 'your', 'their', 'about', 'home', 'news', 'welcome', 'history',
  'board', 'office', 'department', 'athletic', 'athletics', 'baseball', 'softball',
  'team', 'teams', 'staff', 'contact', 'privacy', 'policy', 'site', 'map', 'search',
  'menu', 'main', 'quick', 'links', 'read', 'more', 'view', 'all', 'meet', 'message',
  'page', 'college', 'university', 'school', 'high', 'academy', 'sports', 'sport',
  'season', 'schedule', 'roster', 'coaches', 'coach', 'director', 'president', 'owner',
  'manager', 'general', 'head', 'assistant', 'associate', 'program', 'camp', 'club',
  'league', 'center', 'centre', 'field', 'park', 'complex', 'information', 'directory',
  'for', 'vice', 'var', 'obj', 'and', 'function', 'return', 'enrollment', 'recreation',
  'services', 'admissions', 'apply', 'visit', 'info', 'request', 'health', 'human',
]);

function cleanText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

function plausibleName(s: string): boolean {
  const parts = s.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((p) => {
    const w = p.replace(/[.,]/g, '').toLowerCase();
    return w.length < 2 || !NAME_STOP.has(w);
  });
}

function pickName(html: string): string | null {
  const text = cleanText(html);
  // "Head Coach: Mike Deegan" — separator required for precision.
  const coach = text.match(new RegExp(`(?:${COACH_ROLE})\\s*[:\\-–|]\\s*${NAME}`, 'i'));
  if (coach && plausibleName(coach[1])) return coach[1];
  // "Mike Deegan, Head Baseball Coach"
  const named = text.match(new RegExp(`${NAME}\\s*,\\s*(?:${COACH_ROLE}|${CONTACT_ROLE})`, 'i'));
  if (named && plausibleName(named[1])) return named[1];
  // "Owner: John Doe" / "Athletic Director: Jane Roe"
  const contact = text.match(new RegExp(`(?:${CONTACT_ROLE})\\s*[:\\-–|]\\s*${NAME}`, 'i'));
  if (contact && plausibleName(contact[1])) return contact[1];
  return null;
}

export interface Contact {
  email: string | null;
  phone: string | null;
  contactName: string | null;
}

export async function findContact(website: string, deep = true): Promise<Contact> {
  const base = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const home = await fetchText(base);
  let email = home ? pickEmail(home) : null;
  let phone = home ? pickPhone(home) : null;
  let contactName = home ? pickName(home) : null;
  if (!home) return { email, phone, contactName };

  // deep: crawl homepage -> athletics -> baseball/softball -> coaches.
  // quick (deep=false): homepage + the single best contact page only — fast
  // enough to auto-run across many search results.
  const visited = new Set<string>([base]);
  let queue = candidateLinks(home, base).filter((u) => !visited.has(u));
  let budget = deep ? 3 : 1;

  while (queue.length && budget > 0 && !(contactName && email)) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    budget--;
    const page = await fetchText(url);
    if (!page) continue;
    email = email ?? pickEmail(page);
    phone = phone ?? pickPhone(page);
    contactName = contactName ?? pickName(page);
    if (deep && !contactName) {
      const deeper = candidateLinks(page, url).filter((u) => !visited.has(u));
      queue = [...deeper, ...queue];
    }
  }
  return { email, phone, contactName };
}
