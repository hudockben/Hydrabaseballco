-- Run this once in the Neon SQL Editor to add the Customer List table.

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
