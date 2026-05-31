-- Fillout edit link for viewing a completed checklist (full submission, not PDF)
alter table tasks add column if not exists checklist_submission_url text;
