import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Row = Record<string, unknown>;

const MOVE_KINDS = ['receive', 'ship', 'adjust'] as const;

/** Trim a value; empty becomes null so blank cells stay clean. */
const s = (v: unknown): string | null => {
  const t = (v == null ? '' : String(v)).trim();
  return t || null;
};
/** Parse a money/decimal value, defaulting to 0 (columns are NOT NULL). */
const num = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
/** Parse an integer value, defaulting to 0. */
const int = (v: unknown): number => {
  const x = Math.trunc(Number(v));
  return Number.isFinite(x) ? x : 0;
};

function mapItem(r: Row) {
  return {
    id: Number(r.id),
    sku: (r.sku as string) ?? null,
    name: (r.name as string) ?? null,
    category: (r.category as string) ?? null,
    quantity: Number(r.quantity ?? 0),
    reorderLevel: Number(r.reorder_level ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    supplier: (r.supplier as string) ?? null,
    location: (r.location as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

function mapMovement(r: Row) {
  return {
    id: Number(r.id),
    delta: Number(r.delta ?? 0),
    kind: String(r.kind ?? 'adjust'),
    reason: (r.reason as string) ?? null,
    createdAt: r.created_at as string,
  };
}

const CSV_HEADER = ['SKU', 'Name', 'Category', 'On hand', 'Reorder level',
  'Unit cost', 'Unit price', 'Supplier', 'Location', 'Notes'];
const CSV_COLS = ['sku', 'name', 'category', 'quantity', 'reorder_level',
  'unit_cost', 'unit_price', 'supplier', 'location', 'notes'];

function toCsv(rows: Row[]): string {
  const esc = (v: unknown) => {
    const str = v == null ? '' : String(v);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  const lines = rows.map((r) => CSV_COLS.map((c) => esc(r[c])).join(','));
  return [CSV_HEADER.join(','), ...lines].join('\n');
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);

    // Movement history for one item: /api/admin/inventory?movements=<id>
    const moveFor = url.searchParams.get('movements');
    if (moveFor) {
      const itemId = Number(moveFor);
      if (!itemId) return NextResponse.json({ error: 'Bad item id' }, { status: 400 });
      const rows = (await sql`
        select id, delta, kind, reason, created_at
        from inventory_movements
        where item_id = ${itemId}
        order by created_at desc, id desc
        limit 50`) as Row[];
      return NextResponse.json({ movements: rows.map(mapMovement) });
    }

    const rows = (await sql`
      select * from inventory_items
      order by name asc nulls last, id asc`) as Row[];

    if (url.searchParams.get('format') === 'csv') {
      return new NextResponse(toCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hydra-inventory-${Date.now()}.csv"`,
        },
      });
    }
    return NextResponse.json({ items: rows.map(mapItem) });
  } catch (err) {
    console.error('inventory GET error', err);
    return NextResponse.json({ error: 'Database not connected — run the migration.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const sql = getSql();

    // Stock movement: { move: { id, delta, kind, reason } }
    // Updates on-hand and logs the movement atomically; refuses to go negative.
    if (body.move && typeof body.move === 'object') {
      const id = Number(body.move.id);
      const delta = int(body.move.delta);
      const kind = MOVE_KINDS.includes(body.move.kind) ? body.move.kind : 'adjust';
      const reason = s(body.move.reason);
      if (!id) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
      if (!delta) return NextResponse.json({ error: 'Enter a non-zero quantity.' }, { status: 400 });

      const result = (await sql`
        with upd as (
          update inventory_items
             set quantity = quantity + ${delta},
                 updated_at = now()
           where id = ${id}
             and quantity + ${delta} >= 0
          returning quantity
        ),
        logged as (
          insert into inventory_movements (item_id, delta, kind, reason)
          select ${id}, ${delta}, ${kind}, ${reason}
           where exists (select 1 from upd)
          returning id
        )
        select quantity from upd`) as Row[];

      if (!result.length) {
        return NextResponse.json(
          { error: 'Not enough stock on hand for that change.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ quantity: Number(result[0].quantity) });
    }

    // Add a (blank) item; fields are filled in via inline editing.
    const rows = (await sql`
      insert into inventory_items
        (sku, name, category, reorder_level, unit_cost, unit_price, supplier, location, notes)
      values
        (${s(body.sku)}, ${s(body.name)}, ${s(body.category)}, ${int(body.reorderLevel)},
         ${num(body.unitCost)}, ${num(body.unitPrice)}, ${s(body.supplier)},
         ${s(body.location)}, ${s(body.notes)})
      returning *`) as Row[];
    return NextResponse.json({ item: mapItem(rows[0]) });
  } catch (err) {
    console.error('inventory POST error', err);
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
    // Note: quantity is intentionally not edited here — it changes only through
    // movements so the audit log stays truthful.
    await sql`
      update inventory_items set
        sku = ${s(body.sku)},
        name = ${s(body.name)},
        category = ${s(body.category)},
        reorder_level = ${int(body.reorderLevel)},
        unit_cost = ${num(body.unitCost)},
        unit_price = ${num(body.unitPrice)},
        supplier = ${s(body.supplier)},
        location = ${s(body.location)},
        notes = ${s(body.notes)},
        updated_at = now()
      where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('inventory PATCH error', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const sql = getSql();
    await sql`delete from inventory_items where id = ${id}`; // movements cascade
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('inventory DELETE error', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
