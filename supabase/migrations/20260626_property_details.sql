-- Per-property operational details (lease, backup lockbox, utilities, etc.).

create table if not exists property_details (
	property_id text primary key,
	rent numeric,
	lease_utilities numeric,
	lease_electric numeric,
	lease_internet numeric,
	lease_parking numeric,
	lease_expiration date,
	renewal_notice_due date,
	square_feet integer,
	year_built integer,
	mailbox text not null default '',
	parking_number text not null default '',
	parking_code text not null default '',
	backup_lockbox_location text not null default '',
	backup_lockbox_code text not null default '',
	backup_date_confirmed date,
	backup_image_storage_path text,
	utilities_provider text not null default '',
	utilities_account_number text not null default '',
	internet_provider text not null default '',
	internet_account_number text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.property_details enable row level security;

grant all on table public.property_details to service_role;
grant all on table public.property_details to postgres;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'property-backup-images',
	'property-backup-images',
	true,
	6291456,
	array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;
