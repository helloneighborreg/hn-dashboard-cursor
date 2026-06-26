-- Supply order delivery timestamp and invoice payment tracking.
-- (Replaces the column-add portion of 20260631_supply_order_workflow.sql — do not run that
-- file as-is; it auto-marks submitted orders delivered and limits one active order.)

ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS expense_id uuid;
