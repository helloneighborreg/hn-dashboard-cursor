-- Per-property management fee percentage for owner statement calculations.

alter table property_owners
	add column if not exists management_fee_percent numeric(5, 2) not null default 20;
