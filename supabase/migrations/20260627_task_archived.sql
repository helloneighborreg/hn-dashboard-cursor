-- Hide tasks older than 30 days from dashboard/lists while keeping them searchable.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_archived_at_idx ON tasks (archived_at);
