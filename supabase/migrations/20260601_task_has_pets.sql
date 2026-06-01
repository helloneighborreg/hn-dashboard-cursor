alter table tasks add column if not exists has_pets boolean not null default false;
alter table tasks add column if not exists pet_count integer not null default 0;
