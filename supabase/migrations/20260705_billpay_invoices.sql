-- Billpay invoices generated when tasks are marked paid

CREATE TABLE IF NOT EXISTS billpay_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  payee text,
  property_id text,
  property_name text,
  reservation_id text,
  guest_name text,
  checkout_date date,
  description text,
  task_type text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  base_amount numeric(10,2) NOT NULL DEFAULT 0,
  additional_amount numeric(10,2) NOT NULL DEFAULT 0,
  additional_description text,
  paid_at timestamptz,
  paid_by text,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billpay_invoices_status ON billpay_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billpay_invoices_payee ON billpay_invoices(payee);
CREATE INDEX IF NOT EXISTS idx_billpay_invoices_checkout_date ON billpay_invoices(checkout_date);

grant all on table public.billpay_invoices to service_role;
grant all on table public.billpay_invoices to postgres;
alter table public.billpay_invoices disable row level security;
