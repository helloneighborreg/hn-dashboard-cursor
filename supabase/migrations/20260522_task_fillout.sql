-- Run in Supabase SQL Editor if tasks table already exists

alter table tasks add column if not exists fillout_submission_id text;
alter table tasks add column if not exists checklist_pdf_url text;
