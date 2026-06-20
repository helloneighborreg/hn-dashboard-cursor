-- Defense-in-depth: enable Row Level Security on all app tables.
--
-- The dashboard connects with the Supabase service_role key, which has the BYPASSRLS
-- attribute, so enabling RLS does NOT change app behavior. With no policies defined,
-- the anon and authenticated roles (e.g. a leaked anon key) get zero table access
-- instead of relying solely on the absence of table grants.
--
-- Apply in Supabase: SQL Editor → New query → paste → Run.

alter table public.tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.bank_connection enable row level security;
alter table public.bank_transactions enable row level security;
