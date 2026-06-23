-- PDF storage path for approved owner statements.

alter table owner_statement_approvals
	add column if not exists pdf_storage_path text;

insert into storage.buckets (id, name, public)
values ('owner-statements', 'owner-statements', false)
on conflict (id) do nothing;
