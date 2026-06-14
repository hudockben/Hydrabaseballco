-- Hydra Prospector schema. Run this once against your Neon database
-- (Neon Console -> SQL Editor, paste, Run).

create table if not exists prospects (
  id           bigint generated always as identity primary key,
  name         text not null,
  type         text not null default 'other'
               check (type in ('college', 'facility', 'league', 'highschool', 'other')),
  status       text not null default 'new'
               check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  email        text,
  phone        text,
  contact_name text,
  website      text,
  address      text,
  city         text,
  state        text,
  postal_code  text,
  country      text default 'US',
  latitude     double precision,
  longitude    double precision,
  source       text not null,
  source_id    text not null,
  level        text,
  notes        text,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists prospects_status_idx on prospects (status);
create index if not exists prospects_type_idx   on prospects (type);

-- Optional activity log for future call/email notes.
create table if not exists prospect_activity (
  id           bigint generated always as identity primary key,
  prospect_id  bigint not null references prospects (id) on delete cascade,
  kind         text not null default 'note',
  body         text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pricing & revenue (the "backside": costs, pricing points, profit, margin)
-- ---------------------------------------------------------------------------

-- Products you sell, with the per-unit costs used to compute margins.
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text not null,
  sku         text,
  unit_cost   numeric(12, 2) not null default 0, -- COGS per ball
  ship_cost   numeric(12, 2) not null default 0, -- default shipping per ball
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Volume price breaks per product (e.g. 1–99, 100–499, 500+).
create table if not exists price_tiers (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references products (id) on delete cascade,
  min_qty     integer not null default 1, -- tier applies at this quantity or more
  unit_price  numeric(12, 2) not null default 0,
  unique (product_id, min_qty)
);
create index if not exists price_tiers_product_idx on price_tiers (product_id);

-- Sales. Each order is usually tied to a "won" prospect; costs are snapshotted
-- at sale time so later cost changes don't rewrite historical profit.
create table if not exists orders (
  id            bigint generated always as identity primary key,
  prospect_id   bigint references prospects (id) on delete set null,
  product_id    bigint references products (id) on delete set null,
  customer_name text, -- snapshot, survives prospect deletion
  quantity      integer not null default 0,
  unit_price    numeric(12, 2) not null default 0, -- price charged per unit
  unit_cost     numeric(12, 2) not null default 0, -- COGS per unit at sale time
  shipping_cost numeric(12, 2) not null default 0, -- total shipping for the order
  other_cost    numeric(12, 2) not null default 0, -- any extra per-order cost
  status        text not null default 'confirmed'
                check (status in ('quote', 'confirmed', 'fulfilled', 'paid')),
  ordered_at    date not null default current_date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_prospect_idx   on orders (prospect_id);
create index if not exists orders_product_idx    on orders (product_id);
create index if not exists orders_ordered_at_idx on orders (ordered_at);

-- Customer List: a manually-maintained recruiting sheet (college programs to
-- sell to), separate from the auto-populated `prospects` pipeline.
create table if not exists customers (
  id                 bigint generated always as identity primary key,
  state              text,
  school             text,
  conference         text,
  roster_link        text,
  division           text,
  first_degree_conn  text,
  first_degree_notes text,
  instagram          text,
  email              text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists customers_state_idx  on customers (state);
create index if not exists customers_school_idx on customers (school);
