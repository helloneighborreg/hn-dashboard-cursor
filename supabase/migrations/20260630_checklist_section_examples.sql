-- Reference photos shown on checklist sections (same for every submission).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS form_checklist_section_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_slug text NOT NULL,
  section_id text NOT NULL,
  storage_path text NOT NULL,
  filename text,
  content_type text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_checklist_section_examples_lookup
  ON form_checklist_section_examples (form_slug, section_id, sort_order);

grant all on table public.form_checklist_section_examples to service_role;
grant all on table public.form_checklist_section_examples to postgres;

alter table public.form_checklist_section_examples disable row level security;
