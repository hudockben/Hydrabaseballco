import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql } from '@/lib/db';
import type { ProspectInput } from '@/lib/connectors';

export const dynamic = 'force-dynamic';

const CSV_COLS = [
  'name', 'type', 'status', 'email', 'phone', 'website',
  'address', 'city', 'state', 'postal_code', 'level', 'source', 'created_at',
];

function toCsv(rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = rows.map((r) => CSV_COLS.map((c) => esc(r[c])).join(','));
  return [CSV_COLS.join(','), ...lines].join('\n');
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const rows = (await sql`
      select * from prospects
      where (${status}::text is null or status = ${status})
        and (${type}::text is null or type = ${type})
      order by created_at desc
      limit 2000`) as Record<string, unknown>[];

    if (url.searchParams.get('format') === 'csv') {
      return new NextResponse(toCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hydra-prospects-${Date.now()}.csv"`,
        },
      });
    }
    return NextResponse.json({ prospects: rows });
  } catch (err) {
    console.error('crm GET error', err);
    return NextResponse.json({ error: 'Database not connected.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const items: ProspectInput[] = Array.isArray(body.prospects) ? body.prospects : [];
  if (!items.length) return NextResponse.json({ error: 'No prospects provided.' }, { status: 400 });
  try {
    const sql = getSql();
    let saved = 0;
    for (const p of items) {
      await sql`
        insert into prospects
          (name, type, email, phone, website, address, city, state, postal_code,
           country, latitude, longitude, source, source_id, level, raw)
        values
          (${p.name}, ${p.type}, ${p.email ?? null}, ${p.phone ?? null}, ${p.website ?? null},
           ${p.address ?? null}, ${p.city ?? null}, ${p.state ?? null}, ${p.postalCode ?? null},
           ${p.country ?? 'US'}, ${p.latitude ?? null}, ${p.longitude ?? null},
           ${p.source}, ${p.sourceId}, ${p.level ?? null},
           ${JSON.stringify(p.raw ?? null)}::jsonb)
        on conflict (source, source_id) do nothing`;
      saved++;
    }
    return NextResponse.json({ saved });
  } catch (err) {
    console.error('crm POST error', err);
    return NextResponse.json({ error: 'Could not save — is the database connected?' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = getSql();
    const status = (body.status as string | undefined) ?? null;
    const notes = (body.notes as string | undefined) ?? null;
    const email = (body.email as string | undefined) ?? null;
    const phone = (body.phone as string | undefined) ?? null;
    await sql`
      update prospects
      set status = coalesce(${status}, status),
          notes = coalesce(${notes}, notes),
          email = coalesce(${email}, email),
          phone = coalesce(${phone}, phone),
          updated_at = now()
      where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('crm PATCH error', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = getSql();
    await sql`delete from prospects where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('crm DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
