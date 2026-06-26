-- Multiple open supply orders; payment tracking and expense link.

DROP INDEX IF EXISTS idx_supply_orders_one_active;

ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS expense_id uuid;

CREATE INDEX IF NOT EXISTS idx_supply_orders_open
  ON supply_orders (created_at DESC)
  WHERE status IN ('draft', 'submitted');
