-- Approved owner statement snapshots created from selected reservations.

create table if not exists owner_statement_approvals (
	id uuid primary key default gen_random_uuid(),
	property_id text not null,
	statement_period text not null,
	date_from date,
	date_to date,
	reservation_ids text[] not null default '{}',
	statement_data jsonb not null,
	approved_at timestamptz not null default now()
);

create index if not exists owner_statement_approvals_property
	on owner_statement_approvals (property_id, approved_at desc);

alter table public.owner_statement_approvals enable row level security;

grant all on table public.owner_statement_approvals to service_role;
grant all on table public.owner_statement_approvals to postgres;
