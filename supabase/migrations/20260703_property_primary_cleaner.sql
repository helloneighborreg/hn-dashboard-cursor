-- Primary cleaner assignment per property (matches dashboard user display name).

alter table property_details
	add column if not exists primary_cleaner text not null default '';
