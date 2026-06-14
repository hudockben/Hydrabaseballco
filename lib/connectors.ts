// Free / public data connectors for prospecting. No paid APIs.
// - Facilities: OpenStreetMap (Overpass) + Nominatim geocoding
// - Colleges:   US Dept. of Education College Scorecard (public DEMO_KEY)
//
// Each returns a normalized ProspectInput[]. Connectors are intentionally
// isolated so a paid source (Google Places, Hunter, etc.) can be dropped in
// later without touching the rest of the app.

export type ProspectType = 'college' | 'facility' | 'league' | 'other';

export interface ProspectInput {
  name: string;
  type: ProspectType;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: string;
  sourceId: string;
  level?: string | null;
  raw?: unknown;
  // Response-only (computed in the search API; not stored in the DB):
  distanceMi?: number | null;
  saved?: boolean;
}

const UA = 'HydraProspector/1.0 (+https://hydrabaseballcompany.vercel.app)';

interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

export async function geocode(location: string): Promise<GeocodeResult | null> {
  // Bias to the US — a bare ZIP like "43004" otherwise matches places abroad
  // (e.g. Tarragona, Spain shares that postcode).
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
    encodeURIComponent(location);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name };
}

/** Great-circle distance in miles between two lat/lon points. */
export function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface OverpassEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function searchFacilities(opts: {
  lat: number;
  lon: number;
  radiusKm: number;
  keyword?: string;
}): Promise<ProspectInput[]> {
  const meters = Math.round(Math.max(1, Math.min(opts.radiusKm, 320)) * 1000);
  // A selective `sport` filter is fast and reliable on the public Overpass
  // server (broad tag scans time out). Captures baseball/softball pitches,
  // complexes, and clubs near the location.
  const query = `[out:json][timeout:25];
nwr["sport"~"baseball|softball"](around:${meters},${opts.lat},${opts.lon});
out center tags 120;`;
  let data: { elements?: OverpassEl[] };
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(28000),
    });
    if (!res.ok) return [];
    data = (await res.json()) as { elements?: OverpassEl[] };
  } catch {
    return []; // Overpass timeout/unavailable — the caller shows a friendly message.
  }
  const kw = opts.keyword?.toLowerCase().trim();
  const seen = new Set<string>();
  const out: ProspectInput[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const named = Boolean(tags.name);
    const sportLabel = (tags.sport ?? '').includes('softball') ? 'Softball' : 'Baseball';
    const name =
      tags.name ?? `${sportLabel} field${tags['addr:city'] ? ' — ' + tags['addr:city'] : ''}`;
    if (kw && !name.toLowerCase().includes(kw)) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const address = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null;
    out.push({
      name,
      type: 'facility',
      phone: tags.phone ?? tags['contact:phone'] ?? null,
      email: tags.email ?? tags['contact:email'] ?? null,
      website: tags.website ?? tags['contact:website'] ?? null,
      address,
      city: tags['addr:city'] ?? null,
      state: tags['addr:state'] ?? null,
      postalCode: tags['addr:postcode'] ?? null,
      country: tags['addr:country'] ?? 'US',
      latitude: el.lat ?? el.center?.lat ?? null,
      longitude: el.lon ?? el.center?.lon ?? null,
      source: 'osm',
      sourceId: id,
      level: named ? (tags.leisure ?? tags.sport ?? null) : 'unnamed field',
      raw: el,
    });
  }
  return out;
}

interface ScorecardRow {
  id: number;
  'school.name'?: string;
  'school.city'?: string;
  'school.state'?: string;
  'school.school_url'?: string;
  'location.lat'?: number;
  'location.lon'?: number;
  'school.degrees_awarded.predominant'?: number;
  'school.ownership'?: number;
}

function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export async function searchColleges(opts: {
  location?: string;
  radiusKm?: number;
  keyword?: string;
}): Promise<ProspectInput[]> {
  const key = process.env.SCORECARD_API_KEY || 'DEMO_KEY';
  const params = new URLSearchParams();
  params.set('api_key', key);
  params.set('per_page', '100');
  params.set(
    'fields',
    'id,school.name,school.city,school.state,school.school_url,location.lat,location.lon,school.degrees_awarded.predominant,school.ownership',
  );
  params.set('school.operating', '1');
  // Tailor to real athletic-program schools: associate / bachelor / graduate
  // degree-granting, public or private-nonprofit. This drops for-profit trade
  // schools (barber, cosmetology, IT) that never field baseball/softball teams.
  params.set('school.degrees_awarded.predominant', '2,3,4');
  params.set('school.ownership', '1,2');
  if (opts.keyword) params.set('school.name', opts.keyword);

  const loc = (opts.location || '').trim();
  if (/^\d{5}$/.test(loc)) {
    const miles = Math.round((opts.radiusKm ?? 80) * 0.621371);
    params.set('zip', loc);
    params.set('distance', `${miles}mi`);
  } else if (/^[A-Za-z]{2}$/.test(loc)) {
    params.set('school.state', loc.toUpperCase());
  }

  const url = `https://api.data.gov/ed/collegescorecard/v1/schools?${params.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: ScorecardRow[] };
  const out: ProspectInput[] = [];
  for (const row of data.results ?? []) {
    const name = row['school.name'];
    if (!name) continue;
    const predominant = row['school.degrees_awarded.predominant'];
    const level =
      predominant === 4 ? 'Graduate' :
      predominant === 3 ? '4-year college' :
      predominant === 2 ? '2-year college' : 'College';
    out.push({
      name,
      type: 'college',
      website: row['school.school_url'] ? normalizeUrl(row['school.school_url']) : null,
      city: row['school.city'] ?? null,
      state: row['school.state'] ?? null,
      latitude: row['location.lat'] ?? null,
      longitude: row['location.lon'] ?? null,
      country: 'US',
      source: 'scorecard',
      sourceId: String(row.id),
      level,
      raw: row,
    });
  }
  return out;
}
