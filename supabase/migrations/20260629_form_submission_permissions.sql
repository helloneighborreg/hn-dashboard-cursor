-- Fix API access for in-app checklist form tables (permission denied for service_role)

grant all on table public.form_submissions to service_role;
grant all on table public.form_submission_files to service_role;

grant all on table public.form_submissions to postgres;
grant all on table public.form_submission_files to postgres;

alter table public.form_submissions disable row level security;
alter table public.form_submission_files disable row level security;
