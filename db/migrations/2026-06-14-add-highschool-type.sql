-- Run this once in the Neon SQL Editor if your database was created before
-- High Schools and the Coach/Contact column were added.

-- 1) Allow saving high-school prospects.
alter table prospects drop constraint if exists prospects_type_check;
alter table prospects add constraint prospects_type_check
  check (type in ('college', 'facility', 'league', 'highschool', 'other'));

-- 2) Store a coach / contact person's name.
alter table prospects add column if not exists contact_name text;
