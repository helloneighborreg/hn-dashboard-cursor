-- Run once in Supabase: SQL Editor → New query → paste → Run

create table if not exists tasks (
	id uuid primary key,
	reservation_id text not null,
	property_id text,
	property_name text not null default '',
	guest_name text not null default '',
	has_pets boolean not null default false,
	pet_count integer not null default 0,
	checklist_url text,
	fillout_submission_id text,
	checklist_submission_url text,
	checklist_pdf_url text,
	title text not null,
	description text not null default '',
	due_date date not null,
	due_time text not null default '16:00',
	checkout_date date,
	start_time text not null default '10:00',
	status text not null default 'unassigned',
	assignee text,
	type text not null default 'other',
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- One task per reservation (synced from bookings)
create unique index if not exists tasks_one_per_reservation
	on tasks (reservation_id);

create table if not exists expenses (
	id uuid primary key,
	date date not null,
	property_id text not null,
	property_name text not null default '',
	category text not null,
	vendor text,
	amount numeric(12, 2) not null,
	notes text,
	receipt_url text,
	created_at timestamptz not null default now()
);

create index if not exists tasks_due_date on tasks (due_date);
create index if not exists expenses_date on expenses (date desc);
create index if not exists expenses_property on expenses (property_id);

-- Allow the app (service_role) to read/write via the Supabase API
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.tasks to service_role;
grant all on table public.expenses to service_role;
grant all on table public.tasks to postgres;
grant all on table public.expenses to postgres;

alter table public.tasks disable row level security;
alter table public.expenses disable row level security;

create table if not exists bank_connection (
	id text primary key default 'default',
	access_token text,
	item_id text,
	institution_name text,
	accounts jsonb not null default '[]'::jsonb,
	cursor text,
	last_sync timestamptz,
	updated_at timestamptz not null default now()
);

create table if not exists bank_transactions (
	id text primary key,
	external_id text not null unique,
	source text not null default 'plaid',
	date date not null,
	description text not null,
	amount numeric(12, 2) not null,
	account text,
	account_id text,
	pending boolean not null default false,
	category text not null default '',
	property_id text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists bank_transactions_date on bank_transactions (date desc);
create index if not exists bank_transactions_account on bank_transactions (account_id);

grant all on table public.bank_connection to service_role;
grant all on table public.bank_transactions to service_role;
grant all on table public.bank_connection to postgres;
grant all on table public.bank_transactions to postgres;

alter table public.bank_connection disable row level security;
alter table public.bank_transactions disable row level security;
