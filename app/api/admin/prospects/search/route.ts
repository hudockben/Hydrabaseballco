import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import {
  geocode,
  haversineMiles,
  searchColleges,
  searchFacilities,
  searchHighSchools,
  searchLeagues,
  type ProspectInput,
} from '@/lib/connectors';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? 'facility');
  const location = String(body.location ?? '').trim();
  const keyword = body.keyword ? String(body.keyword).trim() : undefined;
  const radiusMiles = Math.max(1, Math.min(Number(body.radiusMiles) || 25, 200));
  const radiusKm = radiusMiles * 1.60934;
  // State abbreviation from "City, ST" or a bare "ST" — used to filter colleges
  // (Scorecard filters by ZIP+distance or state, not by lat/lon radius).
  const stateAbbr =
    (location.match(/,\s*([A-Za-z]{2})\s*$/)?.[1] ?? (/^[A-Za-z]{2}$/.test(location) ? location : ''))
      .toUpperCase() || undefined;

  if (!location) {
    return NextResponse.json({ error: 'Please enter a location.' }, { status: 400 });
  }

  try {
    const center = await geocode(location);
    const needsCenter =
      type === 'facility' || type === 'highschool' || type === 'league' || type === 'all';
    if (needsCenter && !center) {
      return NextResponse.json(
        { error: "Couldn't find that location — try a city + state or a ZIP." },
        { status: 400 },
      );
    }

    let results: ProspectInput[] = [];
    if (type === 'all') {
      const c = center!;
      const settled = await Promise.allSettled([
        searchFacilities({ lat: c.lat, lon: c.lon, radiusKm, keyword }),
        searchHighSchools({ lat: c.lat, lon: c.lon, radiusKm, keyword }),
        searchLeagues({ lat: c.lat, lon: c.lon, radiusKm, keyword }),
        searchColleges({ location, state: stateAbbr, radiusKm, keyword }),
      ]);
      for (const s of settled) if (s.status === 'fulfilled') results.push(...s.value);
    } else if (type === 'facility') {
      results = await searchFacilities({ lat: center!.lat, lon: center!.lon, radiusKm, keyword });
    } else if (type === 'highschool') {
      results = await searchHighSchools({ lat: center!.lat, lon: center!.lon, radiusKm, keyword });
    } else if (type === 'league') {
      results = await searchLeagues({ lat: center!.lat, lon: center!.lon, radiusKm, keyword });
    } else if (type === 'college') {
      results = await searchColleges({ location, state: stateAbbr, radiusKm, keyword });
    } else {
      return NextResponse.json({ error: `The "${type}" source isn't available yet.` }, { status: 400 });
    }

    // "All types" runs several connectors, and one place (e.g. a baseball club)
    // can come back from more than one — same source/source_id. Keep the first
    // so it isn't rendered twice or silently dropped by the unique key on save.
    const byKey = new Map<string, ProspectInput>();
    for (const r of results) {
      const key = `${r.source}/${r.sourceId}`;
      if (!byKey.has(key)) byKey.set(key, r);
    }
    results = [...byKey.values()];

    // Distance from the search center + nearest-first ordering.
    if (center) {
      for (const r of results) {
        if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
          r.distanceMi = Math.round(haversineMiles(center.lat, center.lon, r.latitude, r.longitude) * 10) / 10;
        }
      }
      results.sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
    }

    // Flag prospects already in the CRM so the user doesn't re-add them.
    try {
      const ids = results.map((r) => r.sourceId);
      if (ids.length) {
        const sql = getSql();
        const rows = (await sql`
          select source, source_id from prospects where source_id = any(${ids}::text[])
        `) as { source: string; source_id: string }[];
        const savedSet = new Set(rows.map((x) => `${x.source}/${x.source_id}`));
        for (const r of results) r.saved = savedSet.has(`${r.source}/${r.sourceId}`);
      }
    } catch {
      // DB not connected — skip the dedupe flags, search still works.
    }

    return NextResponse.json({ count: results.length, radiusMiles, results });
  } catch (err) {
    console.error('search error', err);
    return NextResponse.json({ error: 'Search failed — please try again.' }, { status: 500 });
  }
}
