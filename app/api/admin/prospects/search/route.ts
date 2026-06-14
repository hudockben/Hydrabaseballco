import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { searchColleges, searchFacilities, type ProspectInput } from '@/lib/connectors';

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
  const radiusKm = Number(body.radiusKm) || 80;

  if (!location) {
    return NextResponse.json({ error: 'Please enter a location.' }, { status: 400 });
  }

  try {
    let results: ProspectInput[] = [];
    if (type === 'facility') {
      results = await searchFacilities({ location, radiusKm, keyword });
    } else if (type === 'college') {
      results = await searchColleges({ location, radiusKm, keyword });
    } else {
      return NextResponse.json({ error: `The "${type}" source isn't available yet.` }, { status: 400 });
    }
    return NextResponse.json({ count: results.length, results });
  } catch (err) {
    console.error('search error', err);
    return NextResponse.json({ error: 'Search failed — please try again.' }, { status: 500 });
  }
}
