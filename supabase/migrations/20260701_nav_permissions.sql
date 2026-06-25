-- Nav visibility permissions (Settings → Permissions)

create table if not exists public.app_settings (
	key text primary key,
	value jsonb not null default '{}'::jsonb,
	updated_at timestamptz not null default now()
);

grant all on table public.app_settings to service_role;
grant all on table public.app_settings to postgres;

alter table public.app_settings disable row level security;
