-- Link bank deposits to Hospitable reservation payouts
alter table bank_transactions
  add column if not exists matched_reservation_id text,
  add column if not exists matched_payout_amount numeric(12, 2);

create index if not exists bank_transactions_matched_reservation
  on bank_transactions (matched_reservation_id)
  where matched_reservation_id is not null;
