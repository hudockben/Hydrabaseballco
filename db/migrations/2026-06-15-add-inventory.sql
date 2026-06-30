-- Inventory: physical stock on hand + an audit log of every stock movement.
-- Run this in the Neon SQL editor if your database predates the Inventory tab.

create table if not exists inventory_items (
  id            bigint generated always as identity primary key,
  sku           text,
  name          text,
  category      text,
  quantity      integer not null default 0,        -- on hand; only changed via movements
  reorder_level integer not null default 0,        -- low-stock threshold (0 = untracked)
  unit_cost     numeric(12, 2) not null default 0, -- what it costs us per unit
  unit_price    numeric(12, 2) not null default 0, -- what we sell it for per unit
  supplier      text,
  location      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists inventory_items_name_idx on inventory_items (name);
create index if not exists inventory_items_sku_idx  on inventory_items (sku);

-- Every receive / ship / adjust writes a row here so on-hand history is auditable.
create table if not exists inventory_movements (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references inventory_items (id) on delete cascade,
  delta       integer not null,                    -- +received, -shipped
  kind        text not null default 'adjust'
              check (kind in ('receive', 'ship', 'adjust')),
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists inventory_movements_item_idx
  on inventory_movements (item_id, created_at desc);
