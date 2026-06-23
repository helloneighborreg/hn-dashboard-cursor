-- In-app form submissions (replaces Fillout for CJC turn clean checklist)
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text NOT NULL,
  form_slug text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  reservation_id text,
  property_code text,
  guest_name text,
  cleaner_name text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculations jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_slug ON form_submissions (form_slug);
CREATE INDEX IF NOT EXISTS idx_form_submissions_task_id ON form_submissions (task_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_reservation_id ON form_submissions (reservation_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions (submitted_at DESC);

CREATE TABLE IF NOT EXISTS form_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  storage_path text NOT NULL,
  filename text,
  content_type text,
  public_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submission_files_submission ON form_submission_files (submission_id);
CREATE INDEX IF NOT EXISTS idx_form_submission_files_question ON form_submission_files (question_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-checklist-uploads',
  'form-checklist-uploads',
  true,
  12582912,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

grant all on table public.form_submissions to service_role;
grant all on table public.form_submission_files to service_role;

grant all on table public.form_submissions to postgres;
grant all on table public.form_submission_files to postgres;

alter table public.form_submissions disable row level security;
alter table public.form_submission_files disable row level security;

