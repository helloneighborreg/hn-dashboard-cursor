-- Run in Supabase SQL Editor if tasks table already exists

alter table tasks add column if not exists start_time text not null default '10:00';

drop index if exists tasks_turnover_per_reservation;

create unique index if not exists tasks_one_per_reservation on tasks (reservation_id);
