import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import type { ProspectInput } from '@/lib/connectors';

export const dynamic = 'force-dynamic';

const CSV_COLS = [
  'name', 'type', 'status', 'contact_name', 'email', 'phone', 'website',
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
    const sql = await db();
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
    // DB columns are snake_case, but the client reads `contactName`. Expose the
    // camelCase alias so saved coach/contact names load back into the CRM grid.
    const prospects = rows.map((r) => ({ ...r, contactName: r.contact_name }));
    return NextResponse.json({ prospects });
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
    const sql = await db();
    let saved = 0; // rows actually inserted (skips ones already in the CRM)
    let duplicate = 0;
    let firstError: string | null = null;
    for (const p of items) {
      try {
        const rows = (await sql`
          insert into prospects
            (name, type, email, phone, contact_name, website, address, city, state, postal_code,
             country, latitude, longitude, source, source_id, level, raw)
          values
            (${p.name}, ${p.type}, ${p.email ?? null}, ${p.phone ?? null}, ${p.contactName ?? null},
             ${p.website ?? null}, ${p.address ?? null}, ${p.city ?? null}, ${p.state ?? null},
             ${p.postalCode ?? null}, ${p.country ?? 'US'}, ${p.latitude ?? null}, ${p.longitude ?? null},
             ${p.source}, ${p.sourceId}, ${p.level ?? null},
             ${JSON.stringify(p.raw ?? null)}::jsonb)
          on conflict (source, source_id) do nothing
          returning id`) as { id: number }[];
        if (rows.length) saved++;
        else duplicate++;
      } catch (rowErr) {
        // Don't let one bad row sink the whole batch — record it and continue.
        if (!firstError) firstError = rowErr instanceof Error ? rowErr.message : String(rowErr);
        console.error('crm POST row error', p.source, p.sourceId, rowErr);
      }
    }
    if (saved === 0 && duplicate === 0 && firstError) {
      return NextResponse.json({ error: `Could not save: ${firstError}` }, { status: 500 });
    }
    return NextResponse.json({ saved, duplicate });
  } catch (err) {
    console.error('crm POST error', err);
    const detail = err instanceof Error ? err.message : 'is the database connected?';
    return NextResponse.json({ error: `Could not save — ${detail}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = await db();
    const status = (body.status as string | undefined) ?? null;
    const notes = (body.notes as string | undefined) ?? null;
    const email = (body.email as string | undefined) ?? null;
    const phone = (body.phone as string | undefined) ?? null;
    const contactName = (body.contact_name as string | undefined) ?? null;
    await sql`
      update prospects
      set status = coalesce(${status}, status),
          notes = coalesce(${notes}, notes),
          email = coalesce(${email}, email),
          phone = coalesce(${phone}, phone),
          contact_name = coalesce(${contactName}, contact_name),
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
    const sql = await db();
    await sql`delete from prospects where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('crm DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
