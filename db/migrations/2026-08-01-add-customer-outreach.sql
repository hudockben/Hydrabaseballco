-- Customer List -> tiered reach-out queue.
--
-- Adds the columns the tiering and the automatic contact lookup write to. The
-- app applies these itself on the first request (see `ensureSchema` in
-- lib/db.ts), so running this by hand is optional — it's here for the record
-- and for anyone applying migrations manually in the Neon SQL editor.

alter table customers add column if not exists coach_name     text;
alter table customers add column if not exists phone          text;
alter table customers add column if not exists website        text;
-- new | contacted | replied | interested | customer | passed
alter table customers add column if not exists status         text not null default 'new';
-- A/B/C/D pinned by hand; beats the computed tier.
alter table customers add column if not exists tier_override  text;
alter table customers add column if not exists last_contacted timestamptz;
-- When the automatic contact lookup last ran for this school.
alter table customers add column if not exists enriched_at    timestamptz;

create index if not exists customers_status_idx on customers (status);
