-- Reservations confirmed for an owner statement month (month = check-in month).
-- The app uses the service_role key (BYPASSRLS), so RLS does not affect the dashboard.

create table if not exists owner_statement_inclusions (
	property_id text not null,
	reservation_id text not null,
	statement_month text not null,
	created_at timestamptz not null default now(),
	primary key (property_id, reservation_id)
);

create index if not exists owner_statement_inclusions_month
	on owner_statement_inclusions (property_id, statement_month);

alter table public.owner_statement_inclusions enable row level security;

grant all on table public.owner_statement_inclusions to service_role;
grant all on table public.owner_statement_inclusions to postgres;
