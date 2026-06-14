import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { findContact } from '@/lib/enrich';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const website = String(body.website ?? '').trim();
  if (!website) return NextResponse.json({ error: 'No website to look up.' }, { status: 400 });
  try {
    const contact = await findContact(website);
    return NextResponse.json(contact);
  } catch (err) {
    console.error('enrich error', err);
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 });
  }
}
