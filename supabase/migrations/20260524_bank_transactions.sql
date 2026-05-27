-- Plaid bank connection + imported transactions

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
