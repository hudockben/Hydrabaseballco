-- Run this once in the Neon SQL Editor to add the pricing & revenue tables
-- (products, volume price tiers, and orders) to an existing database.

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

create table if not exists price_tiers (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references products (id) on delete cascade,
  min_qty     integer not null default 1,
  unit_price  numeric(12, 2) not null default 0,
  unique (product_id, min_qty)
);
create index if not exists price_tiers_product_idx on price_tiers (product_id);

create table if not exists orders (
  id            bigint generated always as identity primary key,
  prospect_id   bigint references prospects (id) on delete set null,
  product_id    bigint references products (id) on delete set null,
  customer_name text,
  quantity      integer not null default 0,
  unit_price    numeric(12, 2) not null default 0,
  unit_cost     numeric(12, 2) not null default 0,
  shipping_cost numeric(12, 2) not null default 0,
  other_cost    numeric(12, 2) not null default 0,
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
