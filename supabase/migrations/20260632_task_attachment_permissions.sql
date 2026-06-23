-- Fix API access for task attachment metadata (permission denied for service_role)

grant all on table public.task_attachments to service_role;
grant all on table public.task_attachments to postgres;

alter table public.task_attachments disable row level security;
