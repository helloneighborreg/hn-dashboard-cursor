-- Bookkeeping: user-assigned category, property, review state, notes
alter table bank_transactions
  add column if not exists reviewed boolean not null default false,
  add column if not exists hidden boolean not null default false,
  add column if not exists notes text not null default '';

create index if not exists bank_transactions_reviewed on bank_transactions (reviewed);
create index if not exists bank_transactions_hidden on bank_transactions (hidden);
