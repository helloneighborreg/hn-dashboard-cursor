-- Per-reservation notes on owner statement breakdowns.

create table if not exists owner_statement_reservation_notes (
	property_id text not null,
	reservation_id text not null,
	notes text not null default '',
	updated_at timestamptz not null default now(),
	primary key (property_id, reservation_id)
);

create index if not exists owner_statement_reservation_notes_property
	on owner_statement_reservation_notes (property_id);

alter table public.owner_statement_reservation_notes enable row level security;

grant all on table public.owner_statement_reservation_notes to service_role;
grant all on table public.owner_statement_reservation_notes to postgres;
