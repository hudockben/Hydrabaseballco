import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import {
  geocode,
  haversineMiles,
  searchColleges,
  searchFacilities,
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

  if (!location) {
    return NextResponse.json({ error: 'Please enter a location.' }, { status: 400 });
  }

  try {
    const center = await geocode(location);
    let results: ProspectInput[] = [];

    if (type === 'facility') {
      if (!center) {
        return NextResponse.json(
          { error: "Couldn't find that location — try a city + state or a ZIP." },
          { status: 400 },
        );
      }
      results = await searchFacilities({ lat: center.lat, lon: center.lon, radiusKm, keyword });
    } else if (type === 'college') {
      results = await searchColleges({ location, radiusKm, keyword });
    } else {
      return NextResponse.json({ error: `The "${type}" source isn't available yet.` }, { status: 400 });
    }

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
