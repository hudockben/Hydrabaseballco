-- Hydra Prospector schema. Run this once against your Neon database
-- (Neon Console -> SQL Editor, paste, Run).

create table if not exists prospects (
  id           bigint generated always as identity primary key,
  name         text not null,
  type         text not null default 'other'
               check (type in ('college', 'facility', 'league', 'other')),
  status       text not null default 'new'
               check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  email        text,
  phone        text,
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
