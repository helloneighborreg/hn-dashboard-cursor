alter table tasks
	add column if not exists schedule_locked boolean not null default false;

comment on column tasks.schedule_locked is
	'When true, reservation sync does not overwrite check-in/checkout/due schedule fields.';
