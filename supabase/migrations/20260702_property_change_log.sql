-- Audit log for property page edits (owner info, lease, backup, utilities, notes, etc.).

create table if not exists property_change_log (
	id uuid primary key default gen_random_uuid(),
	property_id text not null,
	section text not null,
	resource text not null,
	changes jsonb not null default '[]'::jsonb,
	edited_by_username text not null,
	edited_by_name text not null default '',
	created_at timestamptz not null default now()
);

create index if not exists property_change_log_property_id_created_at_idx
	on property_change_log (property_id, created_at desc);

alter table public.property_change_log enable row level security;

grant all on table public.property_change_log to service_role;
grant all on table public.property_change_log to postgres;
