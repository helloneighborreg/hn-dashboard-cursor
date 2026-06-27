-- Track when an overdue notification was sent so assignee + admin are only notified once.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;
