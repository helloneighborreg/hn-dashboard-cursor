-- Allocate one bank deposit across multiple reservations (income + adjustments).
alter table bank_transactions
  add column if not exists reservation_splits jsonb not null default '[]'::jsonb;
