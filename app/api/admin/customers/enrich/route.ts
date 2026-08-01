// Automatic contact collection for the Customer List.
//
// Given a school row, work out where its baseball program lives on the web
// (roster link -> athletics site -> College Scorecard lookup by name), crawl to
// the coaching staff, and write back the coach, email, and phone. Blank fields
// only — anything typed by hand is left alone.

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { findProgramContact } from '@/lib/enrich';
import { searchColleges } from '@/lib/connectors';
import { stateAbbr } from '@/lib/customers';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

type Row = Record<string, unknown>;

const s = (v: unknown): string | null => {
  const t = (v == null ? '' : String(v)).trim();
  return t || null;
};

const normalizeName = (v: string) =>
  v.toLowerCase().replace(/\b(university|college|the|of|at|state)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * No roster link on file — ask the College Scorecard for the school's site.
 * Free, no key required, and it already backs the Find Prospects tab.
 */
async function resolveWebsite(school: string, state: string | null): Promise<string | null> {
  try {
    const results = await searchColleges({ keyword: school, state: stateAbbr(state) || undefined });
    if (!results.length) return null;
    const want = normalizeName(school);
    const exact = results.find((r) => normalizeName(r.name) === want);
    const partial = results.find((r) => normalizeName(r.name).includes(want) || want.includes(normalizeName(r.name)));
    return (exact ?? partial ?? results[0]).website ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id) || null;
  const deep = body.deep !== false;

  let rosterLink = s(body.rosterLink);
  let website = s(body.website);
  const school = s(body.school);
  const state = s(body.state);

  // Trust the stored row over whatever the client sent along.
  let stored: Row | null = null;
  if (id) {
    try {
      const sql = await db();
      const [row] = (await sql`select * from customers where id = ${id}`) as Row[];
      stored = row ?? null;
      if (stored) {
        rosterLink = rosterLink ?? s(stored.roster_link);
        website = website ?? s(stored.website);
      }
    } catch {
      /* DB down — still run the lookup and hand the result back. */
    }
  }

  let resolvedSite: string | null = null;
  if (!rosterLink && !website && school) {
    resolvedSite = await resolveWebsite(school, state ?? (stored?.state as string) ?? null);
    website = resolvedSite;
  }

  if (!rosterLink && !website) {
    return NextResponse.json(
      { error: 'No roster link, website, or school name to look up.', found: false },
      { status: 400 },
    );
  }

  try {
    const contact = await findProgramContact({ rosterLink, website, budget: deep ? 6 : 3 });
    const found = Boolean(contact.email || contact.phone || contact.contactName);

    // Persist into empty cells only.
    const updated: Record<string, string> = {};
    if (id) {
      const email = !s(stored?.email) && contact.email ? contact.email : null;
      const phone = !s(stored?.phone) && contact.phone ? contact.phone : null;
      const coach = !s(stored?.coach_name) && contact.contactName ? contact.contactName : null;
      const site = !s(stored?.website) && (resolvedSite || website) ? (resolvedSite || website)! : null;
      try {
        const sql = await db();
        await sql`
          update customers set
            email = coalesce(nullif(email, ''), ${email}),
            phone = coalesce(nullif(phone, ''), ${phone}),
            coach_name = coalesce(nullif(coach_name, ''), ${coach}),
            website = coalesce(nullif(website, ''), ${site}),
            enriched_at = now(),
            updated_at = now()
          where id = ${id}`;
        if (email) updated.email = email;
        if (phone) updated.phone = phone;
        if (coach) updated.coachName = coach;
        if (site) updated.website = site;
      } catch (err) {
        console.error('customer enrich save error', err);
      }
    }

    return NextResponse.json({
      found,
      email: contact.email,
      phone: contact.phone,
      contactName: contact.contactName,
      role: contact.role,
      sourceUrl: contact.sourceUrl,
      website: website ?? null,
      updated,
    });
  } catch (err) {
    console.error('customer enrich error', err);
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 });
  }
}
