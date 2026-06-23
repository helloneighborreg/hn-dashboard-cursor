-- Draft vs submitted status for in-app checklist forms

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

UPDATE form_submissions
SET status = 'submitted'
WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_form_submissions_task_form_status
  ON form_submissions (task_id, form_slug, status);
