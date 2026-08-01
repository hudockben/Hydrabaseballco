import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { csvFilename, customerCsv } from '@/lib/customer-export';
import { scoreAll } from '@/lib/customer-tiers';
import type { CustomerRecord } from '@/lib/customers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Row = Record<string, unknown>;

// DB column -> JSON key, for every text column the UI edits.
const FIELDS: Array<[string, string]> = [
  ['state', 'state'],
  ['school', 'school'],
  ['conference', 'conference'],
  ['roster_link', 'rosterLink'],
  ['division', 'division'],
  ['first_degree_conn', 'firstDegreeConn'],
  ['first_degree_notes', 'firstDegreeNotes'],
  ['instagram', 'instagram'],
  ['email', 'email'],
  ['notes', 'notes'],
  ['coach_name', 'coachName'],
  ['phone', 'phone'],
  ['website', 'website'],
  ['status', 'status'],
  ['tier_override', 'tierOverride'],
];

/** Trim a value; empty becomes null so blank cells stay clean. */
const s = (v: unknown): string | null => {
  const t = (v == null ? '' : String(v)).trim();
  return t || null;
};

/** timestamptz (Date or string, depending on the driver) -> ISO string. */
const iso = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
};

function mapRow(r: Row): CustomerRecord {
  const out: Record<string, unknown> = { id: Number(r.id) };
  for (const [col, key] of FIELDS) out[key] = (r[col] as string) ?? null;
  out.status = ((r.status as string) ?? 'new') || 'new';
  out.lastContacted = iso(r.last_contacted);
  out.enrichedAt = iso(r.enriched_at);
  out.updatedAt = iso(r.updated_at);
  return out as unknown as CustomerRecord;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = await db();
    const rows = (await sql`
      select * from customers
      order by state asc nulls last, school asc nulls last, id asc`) as Row[];
    const params = new URL(req.url).searchParams;
    if (params.get('format') === 'csv') {
      // Full dump, ordered the way the list is: most likely to buy first.
      const scored = scoreAll(rows.map(mapRow), { homeState: params.get('home') });
      scored.sort((a, b) => b.tier.score - a.tier.score);
      return new NextResponse(customerCsv(scored), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csvFilename()}"`,
        },
      });
    }
    return NextResponse.json({ customers: rows.map(mapRow) });
  } catch (err) {
    console.error('customers GET error', err);
    return NextResponse.json({ error: 'Database not connected — run the migration.' }, { status: 500 });
  }
}

/** Bulk insert in chunks of 500 via unnest (one round-trip per chunk). */
async function bulkInsert(rows: Record<string, unknown>[]): Promise<number> {
  const sql = await db();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).filter((r) => FIELDS.some(([, key]) => s(r[key]) != null));
    if (!chunk.length) continue;
    const col = (key: string) => chunk.map((r) => s(r[key]));
    // `status` is NOT NULL, so blanks become 'new' rather than failing the insert.
    const statuses = chunk.map((r) => s(r.status) ?? 'new');
    await sql`
      insert into customers
        (state, school, conference, roster_link, division, first_degree_conn,
         first_degree_notes, instagram, email, notes, coach_name, phone, website, status)
      select * from unnest(
        ${col('state')}::text[], ${col('school')}::text[], ${col('conference')}::text[],
        ${col('rosterLink')}::text[], ${col('division')}::text[], ${col('firstDegreeConn')}::text[],
        ${col('firstDegreeNotes')}::text[], ${col('instagram')}::text[], ${col('email')}::text[],
        ${col('notes')}::text[], ${col('coachName')}::text[], ${col('phone')}::text[],
        ${col('website')}::text[], ${statuses}::text[]
      )`;
    inserted += chunk.length;
  }
  return inserted;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    // Bulk import: { rows: [...] }
    if (Array.isArray(body.rows)) {
      if (body.rows.length > 5000) {
        return NextResponse.json({ error: 'Too many rows at once (max 5000). Split the import.' }, { status: 400 });
      }
      const inserted = await bulkInsert(body.rows);
      return NextResponse.json({ inserted });
    }

    const sql = await db();
    const rows = (await sql`
      insert into customers
        (state, school, conference, roster_link, division, first_degree_conn,
         first_degree_notes, instagram, email, notes, coach_name, phone, website, status)
      values
        (${s(body.state)}, ${s(body.school)}, ${s(body.conference)}, ${s(body.rosterLink)},
         ${s(body.division)}, ${s(body.firstDegreeConn)}, ${s(body.firstDegreeNotes)},
         ${s(body.instagram)}, ${s(body.email)}, ${s(body.notes)}, ${s(body.coachName)},
         ${s(body.phone)}, ${s(body.website)}, ${s(body.status) ?? 'new'})
      returning *`) as Row[];
    return NextResponse.json({ customer: mapRow(rows[0]) });
  } catch (err) {
    console.error('customers POST error', err);
    return NextResponse.json({ error: 'Could not add the row.' }, { status: 500 });
  }
}

/**
 * Partial update: only the keys present in the body change, so the queue can
 * flip a single status (or drop in an email it just found) without shipping the
 * whole row. `markContacted` stamps the outreach date in the same round-trip.
 */
export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = await db();
    const [existing] = (await sql`select * from customers where id = ${id}`) as Row[];
    if (!existing) return NextResponse.json({ error: 'Row not found' }, { status: 404 });

    // Merge: a key the client didn't send keeps its stored value.
    const v = (col: string, key: string) =>
      (Object.prototype.hasOwnProperty.call(body, key) ? s(body[key]) : s(existing[col]));
    const now = new Date().toISOString();
    const lastContacted = body.markContacted ? now : iso(existing.last_contacted);
    const enrichedAt = body.markEnriched ? now : iso(existing.enriched_at);

    const rows = (await sql`
      update customers set
        state = ${v('state', 'state')},
        school = ${v('school', 'school')},
        conference = ${v('conference', 'conference')},
        roster_link = ${v('roster_link', 'rosterLink')},
        division = ${v('division', 'division')},
        first_degree_conn = ${v('first_degree_conn', 'firstDegreeConn')},
        first_degree_notes = ${v('first_degree_notes', 'firstDegreeNotes')},
        instagram = ${v('instagram', 'instagram')},
        email = ${v('email', 'email')},
        notes = ${v('notes', 'notes')},
        coach_name = ${v('coach_name', 'coachName')},
        phone = ${v('phone', 'phone')},
        website = ${v('website', 'website')},
        status = ${v('status', 'status') ?? 'new'},
        tier_override = ${v('tier_override', 'tierOverride')},
        last_contacted = ${lastContacted},
        enriched_at = ${enrichedAt},
        updated_at = now()
      where id = ${id}
      returning *`) as Row[];
    return NextResponse.json({ ok: true, customer: mapRow(rows[0]) });
  } catch (err) {
    console.error('customers PATCH error', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = await db();
    await sql`delete from customers where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('customers DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
