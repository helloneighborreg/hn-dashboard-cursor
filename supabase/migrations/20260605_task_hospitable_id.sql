-- Stable Hospitable UUID for matching tasks when checkout date changes.
-- Run in Supabase → SQL Editor (see 20260604_task_checkin.sql for steps).

alter table tasks add column if not exists hospitable_reservation_id text;

create unique index if not exists tasks_hospitable_reservation_id_key
	on tasks (hospitable_reservation_id)
	where hospitable_reservation_id is not null;
