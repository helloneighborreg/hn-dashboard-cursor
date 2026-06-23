-- Run once in Supabase: SQL Editor → New query → paste → Run

create table if not exists tasks (
	id uuid primary key,
	reservation_id text not null,
	hospitable_reservation_id text,
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
	checkin_date date,
	checkin_time text not null default '16:00',
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

-- RLS is enabled as defense-in-depth. The app uses the service_role key (BYPASSRLS),
-- so this does not affect app access; it only blocks anon/authenticated roles.
alter table public.tasks enable row level security;
alter table public.expenses enable row level security;

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
	reviewed boolean not null default false,
	hidden boolean not null default false,
	notes text not null default '',
	matched_reservation_id text,
	matched_payout_amount numeric(12, 2),
	reservation_splits jsonb not null default '[]'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists bank_transactions_date on bank_transactions (date desc);
create index if not exists bank_transactions_account on bank_transactions (account_id);
create index if not exists bank_transactions_reviewed on bank_transactions (reviewed);
create index if not exists bank_transactions_hidden on bank_transactions (hidden);
create index if not exists bank_transactions_matched_reservation on bank_transactions (matched_reservation_id) where matched_reservation_id is not null;

grant all on table public.bank_connection to service_role;
grant all on table public.bank_transactions to service_role;
grant all on table public.bank_connection to postgres;
grant all on table public.bank_transactions to postgres;

alter table public.bank_connection enable row level security;
alter table public.bank_transactions enable row level security;

create table if not exists property_owners (
	property_id text primary key,
	name text not null default '',
	address text not null default '',
	email text not null default '',
	phone text not null default '',
	agreement_expiration date,
	management_fee_percent numeric(5, 2) not null default 20,
	notes text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

grant all on table public.property_owners to service_role;
grant all on table public.property_owners to postgres;

alter table public.property_owners enable row level security;

create table if not exists owner_statement_inclusions (
	property_id text not null,
	reservation_id text not null,
	statement_month text not null,
	created_at timestamptz not null default now(),
	primary key (property_id, reservation_id)
);

create index if not exists owner_statement_inclusions_month
	on owner_statement_inclusions (property_id, statement_month);

grant all on table public.owner_statement_inclusions to service_role;
grant all on table public.owner_statement_inclusions to postgres;

alter table public.owner_statement_inclusions enable row level security;

create table if not exists owner_statement_cash_inclusions (
	property_id text not null,
	item_id text not null,
	item_source text not null,
	statement_month text not null,
	created_at timestamptz not null default now(),
	primary key (property_id, item_id, item_source)
);

create index if not exists owner_statement_cash_inclusions_month
	on owner_statement_cash_inclusions (property_id, statement_month);

grant all on table public.owner_statement_cash_inclusions to service_role;
grant all on table public.owner_statement_cash_inclusions to postgres;

alter table public.owner_statement_cash_inclusions enable row level security;

create table if not exists owner_statement_reservation_notes (
	property_id text not null,
	reservation_id text not null,
	notes text not null default '',
	updated_at timestamptz not null default now(),
	primary key (property_id, reservation_id)
);

create index if not exists owner_statement_reservation_notes_property
	on owner_statement_reservation_notes (property_id);

grant all on table public.owner_statement_reservation_notes to service_role;
grant all on table public.owner_statement_reservation_notes to postgres;

alter table public.owner_statement_reservation_notes enable row level security;

create table if not exists owner_statement_approvals (
	id uuid primary key default gen_random_uuid(),
	property_id text not null,
	statement_period text not null,
	date_from date,
	date_to date,
	reservation_ids text[] not null default '{}',
	statement_data jsonb not null,
	pdf_storage_path text,
	approved_at timestamptz not null default now()
);

create index if not exists owner_statement_approvals_property
	on owner_statement_approvals (property_id, approved_at desc);

grant all on table public.owner_statement_approvals to service_role;
grant all on table public.owner_statement_approvals to postgres;

alter table public.owner_statement_approvals enable row level security;

-- Task attachments (see migrations/20260627_task_attachments.sql)
create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  storage_path text not null,
  filename text,
  content_type text,
  public_url text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_attachments_task_id on task_attachments (task_id);
