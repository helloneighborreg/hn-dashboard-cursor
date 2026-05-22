-- Run in Supabase SQL Editor if tasks table already exists

alter table tasks add column if not exists guest_name text not null default '';
alter table tasks add column if not exists checklist_url text;
