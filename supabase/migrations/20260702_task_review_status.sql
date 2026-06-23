alter table tasks add column if not exists submitted_at timestamptz;
alter table tasks add column if not exists approved_at timestamptz;
alter table tasks add column if not exists completed_at timestamptz;
