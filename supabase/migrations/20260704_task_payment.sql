-- Task payment tracking and who scheduled the request.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scheduled_by text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by text;

-- Legacy workflow: under_review is now completed.
UPDATE tasks
SET status = 'completed'
WHERE status = 'under_review';
