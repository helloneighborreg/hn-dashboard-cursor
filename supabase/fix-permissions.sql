-- Run this in Supabase SQL Editor if you see "permission denied for table tasks"
-- (Tables exist but API roles need access)

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on table public.tasks to service_role;
grant all on table public.expenses to service_role;

grant all on table public.tasks to postgres;
grant all on table public.expenses to postgres;

alter table public.tasks disable row level security;
alter table public.expenses disable row level security;

-- Supplies tables (run if you see "permission denied for table supply_products")
grant all on table public.supply_products to service_role;
grant all on table public.supply_inventory to service_role;
grant all on table public.supply_orders to service_role;
grant all on table public.supply_order_items to service_role;

grant all on table public.supply_products to postgres;
grant all on table public.supply_inventory to postgres;
grant all on table public.supply_orders to postgres;
grant all on table public.supply_order_items to postgres;

alter table public.supply_products disable row level security;
alter table public.supply_inventory disable row level security;
alter table public.supply_orders disable row level security;
alter table public.supply_order_items disable row level security;

-- In-app checklist form tables (run if you see "permission denied for table form_submissions")
grant all on table public.form_submissions to service_role;
grant all on table public.form_submission_files to service_role;

grant all on table public.form_submissions to postgres;
grant all on table public.form_submission_files to postgres;

alter table public.form_submissions disable row level security;
alter table public.form_submission_files disable row level security;

-- Task attachments (run if you see "permission denied for table task_attachments")
grant all on table public.task_attachments to service_role;
grant all on table public.task_attachments to postgres;

alter table public.task_attachments disable row level security;
