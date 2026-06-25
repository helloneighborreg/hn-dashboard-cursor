-- Task lifecycle timestamps for the task detail timeline.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Best-effort backfill for existing rows.
UPDATE tasks
SET assigned_at = created_at
WHERE assigned_at IS NULL
  AND assignee IS NOT NULL
  AND btrim(assignee) <> '';

UPDATE tasks
SET completed_at = updated_at
WHERE completed_at IS NULL
  AND status = 'completed';
