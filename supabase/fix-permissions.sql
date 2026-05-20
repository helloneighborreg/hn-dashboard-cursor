-- Run this in Supabase SQL Editor if you see "permission denied for table tasks"
-- (Tables exist but API roles need access)

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on table public.tasks to service_role;
grant all on table public.expenses to service_role;

grant all on table public.tasks to postgres;
grant all on table public.expenses to postgres;

alter table public.tasks disable row level security;
alter table public.expenses disable row level security;
