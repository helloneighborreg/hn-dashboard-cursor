-- AI photo review results for in-app checklist submissions.

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS photo_review_status text,
  ADD COLUMN IF NOT EXISTS photo_review_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_form_submissions_photo_review_status
  ON form_submissions (photo_review_status)
  WHERE photo_review_status IS NOT NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist_review_status text;

CREATE INDEX IF NOT EXISTS idx_tasks_checklist_review_status
  ON tasks (checklist_review_status)
  WHERE checklist_review_status IS NOT NULL;
