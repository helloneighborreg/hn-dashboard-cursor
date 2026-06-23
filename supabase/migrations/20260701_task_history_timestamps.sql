-- Task lifecycle timestamps for history log

alter table tasks add column if not exists assigned_at timestamptz;
alter table tasks add column if not exists started_at timestamptz;
alter table tasks add column if not exists completed_at timestamptz;

update tasks
set completed_at = updated_at
where status = 'completed'
	and completed_at is null;

update tasks
set assigned_at = coalesce(updated_at, created_at)
where coalesce(assignee, '') <> ''
	and assigned_at is null;
