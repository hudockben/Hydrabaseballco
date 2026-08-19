import { neon } from '@neondatabase/serverless';

let cached: ReturnType<typeof neon> | null = null;

/**
 * Lazily create the Neon SQL client.
 * Done lazily so `next build` doesn't require DATABASE_URL to be present.
 */
export function getSql(): ReturnType<typeof neon> {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Add it in your Vercel project environment variables.');
    }
    cached = neon(url);
  }
  return cached;
}

let schemaReady: Promise<void> | null = null;

/**
 * Run a statement that improves the schema but isn't worth an outage.
 *
 * Table creation still throws — without the tables nothing works. Back-fill
 * `alter`s and indexes go through here instead, so one bad statement degrades a
 * single tab rather than making every page report "database not connected".
 */
async function optional(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error('ensureSchema: skipped a statement', err);
  }
}

/**
 * Create the full schema (idempotently) before reading or writing.
 *
 * `db/schema.sql` and `db/migrations/*.sql` are otherwise run by hand, so a
 * database that predates a feature is missing that feature's table — and every
 * save against it silently fails ("looks like it's not saving"). To make data
 * entry on every tab Just Work, this mirrors the canonical schema with
 * `create table/index if not exists` (plus back-fill `alter`s for older
 * `prospects` tables). All statements are idempotent and run once per server
 * instance; existing data is never touched.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      // --- Tables (ordered so foreign keys resolve) ---------------------------
      await sql`create table if not exists prospects (
        id           bigint generated always as identity primary key,
        name         text not null,
        type         text not null default 'other'
                     check (type in ('college', 'facility', 'league', 'highschool', 'other')),
        status       text not null default 'new'
                     check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
        email        text, phone text, contact_name text, website text,
        address      text, city text, state text, postal_code text,
        country      text default 'US',
        latitude     double precision, longitude double precision,
        source       text not null, source_id text not null,
        level        text, notes text, raw jsonb,
        created_at   timestamptz not null default now(),
        updated_at   timestamptz not null default now(),
        unique (source, source_id))`;

      await sql`create table if not exists prospect_activity (
        id          bigint generated always as identity primary key,
        prospect_id bigint not null references prospects (id) on delete cascade,
        kind        text not null default 'note',
        body        text,
        created_at  timestamptz not null default now())`;

      await sql`create table if not exists products (
        id         bigint generated always as identity primary key,
        name       text not null, sku text,
        unit_cost  numeric(12, 2) not null default 0,
        ship_cost  numeric(12, 2) not null default 0,
        active     boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now())`;

      await sql`create table if not exists price_tiers (
        id         bigint generated always as identity primary key,
        product_id bigint not null references products (id) on delete cascade,
        min_qty    integer not null default 1,
        unit_price numeric(12, 2) not null default 0,
        unique (product_id, min_qty))`;

      await sql`create table if not exists orders (
        id            bigint generated always as identity primary key,
        prospect_id   bigint references prospects (id) on delete set null,
        product_id    bigint references products (id) on delete set null,
        customer_name text,
        quantity      integer not null default 0,
        unit_price    numeric(12, 2) not null default 0,
        unit_cost     numeric(12, 2) not null default 0,
        shipping_cost numeric(12, 2) not null default 0,
        shipping_charged numeric(12, 2) not null default 0,
        other_cost    numeric(12, 2) not null default 0,
        status        text not null default 'confirmed'
                      check (status in ('quote', 'confirmed', 'fulfilled', 'paid')),
        ordered_at    date not null default current_date,
        notes         text,
        created_at    timestamptz not null default now(),
        updated_at    timestamptz not null default now())`;

      await sql`create table if not exists customers (
        id                 bigint generated always as identity primary key,
        state text, school text, conference text, roster_link text, division text,
        first_degree_conn text, first_degree_notes text,
        instagram text, email text, notes text,
        coach_name text, phone text, website text,
        status text not null default 'new',
        tier_override text,
        last_contacted timestamptz, enriched_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now())`;

      await sql`create table if not exists inventory_items (
        id            bigint generated always as identity primary key,
        sku text, name text, category text,
        quantity      integer not null default 0,
        reorder_level integer not null default 0,
        unit_cost     numeric(12, 2) not null default 0,
        unit_price    numeric(12, 2) not null default 0,
        supplier text, location text, notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now())`;

      await sql`create table if not exists inventory_movements (
        id         bigint generated always as identity primary key,
        item_id    bigint not null references inventory_items (id) on delete cascade,
        delta      integer not null,
        kind       text not null default 'adjust'
                   check (kind in ('receive', 'ship', 'adjust')),
        reason     text,
        created_at timestamptz not null default now())`;

      // --- Back-fill columns on databases that predate a feature ---------------
      // These run BEFORE the indexes: an index on a column that doesn't exist
      // yet fails, and a failure here used to take the whole admin down.
      await optional(() => sql`alter table customers add column if not exists coach_name text`);
      await optional(() => sql`alter table customers add column if not exists phone text`);
      await optional(() => sql`alter table customers add column if not exists website text`);
      await optional(() => sql`alter table customers add column if not exists status text not null default 'new'`);
      await optional(() => sql`alter table customers add column if not exists tier_override text`);
      await optional(() => sql`alter table customers add column if not exists last_contacted timestamptz`);
      await optional(() => sql`alter table customers add column if not exists enriched_at timestamptz`);

      // Orders that predate shipping being billable to the customer.
      await optional(() => sql`alter table orders add column if not exists
        shipping_charged numeric(12, 2) not null default 0`);

      // Older `prospects` tables (Coach column + High School type).
      await optional(() => sql`alter table prospects add column if not exists contact_name text`);
      await optional(() => sql`alter table prospects drop constraint if exists prospects_type_check`);
      await optional(() => sql`alter table prospects add constraint prospects_type_check
        check (type in ('college', 'facility', 'league', 'highschool', 'other'))`);

      // --- Indexes -------------------------------------------------------------
      await optional(() => sql`create index if not exists prospects_status_idx on prospects (status)`);
      await optional(() => sql`create index if not exists prospects_type_idx on prospects (type)`);
      await optional(() => sql`create index if not exists price_tiers_product_idx on price_tiers (product_id)`);
      await optional(() => sql`create index if not exists orders_prospect_idx on orders (prospect_id)`);
      await optional(() => sql`create index if not exists orders_product_idx on orders (product_id)`);
      await optional(() => sql`create index if not exists orders_ordered_at_idx on orders (ordered_at)`);
      await optional(() => sql`create index if not exists customers_state_idx on customers (state)`);
      await optional(() => sql`create index if not exists customers_school_idx on customers (school)`);
      await optional(() => sql`create index if not exists customers_status_idx on customers (status)`);
      await optional(() => sql`create index if not exists inventory_items_name_idx on inventory_items (name)`);
      await optional(() => sql`create index if not exists inventory_items_sku_idx on inventory_items (sku)`);
      await optional(() => sql`create index if not exists inventory_movements_item_idx
        on inventory_movements (item_id, created_at desc)`);
    })().catch((err) => {
      // Let a transient failure be retried on the next request.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * The SQL client with the schema guaranteed to exist. Prefer this over
 * `getSql()` in request handlers so a freshly-connected database self-initializes
 * the first time any tab reads or writes — no manual migration step required.
 */
export async function db(): Promise<ReturnType<typeof neon>> {
  const sql = getSql();
  await ensureSchema();
  return sql;
}
