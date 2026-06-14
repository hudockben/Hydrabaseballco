-- Run this once in the Neon SQL Editor if your database was created before
-- High Schools were added. It lets the CRM save 'highschool' prospects.

alter table prospects drop constraint if exists prospects_type_check;
alter table prospects add constraint prospects_type_check
  check (type in ('college', 'facility', 'league', 'highschool', 'other'));
