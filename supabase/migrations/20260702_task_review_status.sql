-- Task review workflow: submitted_at when cleaner submits, approved_at when admin approves.
alter table tasks add column if not exists submitted_at timestamptz;
alter table tasks add column if not exists approved_at timestamptz;
