import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Row = Record<string, unknown>;

// DB column -> JSON key. Order also drives the CSV export.
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
];

/** Trim a value; empty becomes null so blank cells stay clean. */
const s = (v: unknown): string | null => {
  const t = (v == null ? '' : String(v)).trim();
  return t || null;
};

function mapRow(r: Row) {
  const out: Record<string, unknown> = { id: Number(r.id) };
  for (const [col, key] of FIELDS) out[key] = (r[col] as string) ?? null;
  return out;
}

function toCsv(rows: Row[]): string {
  const esc = (v: unknown) => {
    const str = v == null ? '' : String(v);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  const header = ['State', 'School', 'Conference', '2026 Roster Link', 'Division',
    '1st Degree Conn', '1st Degree Notes', 'Instagram', 'Email', 'Notes'];
  const lines = rows.map((r) => FIELDS.map(([col]) => esc(r[col])).join(','));
  return [header.join(','), ...lines].join('\n');
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = await db();
    const rows = (await sql`
      select * from customers
      order by state asc nulls last, school asc nulls last, id asc`) as Row[];
    if (new URL(req.url).searchParams.get('format') === 'csv') {
      return new NextResponse(toCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hydra-customers-${Date.now()}.csv"`,
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
    await sql`
      insert into customers
        (state, school, conference, roster_link, division, first_degree_conn,
         first_degree_notes, instagram, email, notes)
      select * from unnest(
        ${col('state')}::text[], ${col('school')}::text[], ${col('conference')}::text[],
        ${col('rosterLink')}::text[], ${col('division')}::text[], ${col('firstDegreeConn')}::text[],
        ${col('firstDegreeNotes')}::text[], ${col('instagram')}::text[], ${col('email')}::text[],
        ${col('notes')}::text[]
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
         first_degree_notes, instagram, email, notes)
      values
        (${s(body.state)}, ${s(body.school)}, ${s(body.conference)}, ${s(body.rosterLink)},
         ${s(body.division)}, ${s(body.firstDegreeConn)}, ${s(body.firstDegreeNotes)},
         ${s(body.instagram)}, ${s(body.email)}, ${s(body.notes)})
      returning *`) as Row[];
    return NextResponse.json({ customer: mapRow(rows[0]) });
  } catch (err) {
    console.error('customers POST error', err);
    return NextResponse.json({ error: 'Could not add the row.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = await db();
    await sql`
      update customers set
        state = ${s(body.state)},
        school = ${s(body.school)},
        conference = ${s(body.conference)},
        roster_link = ${s(body.rosterLink)},
        division = ${s(body.division)},
        first_degree_conn = ${s(body.firstDegreeConn)},
        first_degree_notes = ${s(body.firstDegreeNotes)},
        instagram = ${s(body.instagram)},
        email = ${s(body.email)},
        notes = ${s(body.notes)},
        updated_at = now()
      where id = ${id}`;
    return NextResponse.json({ ok: true });
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
