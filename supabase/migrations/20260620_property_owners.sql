-- Per-property owner contact info (used on owner statements).
-- The app uses the service_role key (BYPASSRLS), so RLS does not affect the dashboard.
-- With RLS on and no policies, anon/authenticated roles get no access.
--
-- Supabase SQL Editor may warn about RLS — choose "Run and enable RLS".

create table if not exists property_owners (
	property_id text primary key,
	name text not null default '',
	address text not null default '',
	email text not null default '',
	phone text not null default '',
	agreement_expiration date,
	notes text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.property_owners enable row level security;

grant all on table public.property_owners to service_role;
grant all on table public.property_owners to postgres;
