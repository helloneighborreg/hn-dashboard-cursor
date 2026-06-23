-- Supply order workflow: one active cart/order at a time (draft → submitted → delivered).

ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Historical submitted orders already received inventory on submit.
UPDATE supply_orders
SET status = 'delivered', delivered_at = COALESCE(submitted_at, created_at)
WHERE status = 'submitted';

-- Only one draft or submitted order may exist at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_supply_orders_one_active
  ON supply_orders ((true))
  WHERE status IN ('draft', 'submitted');
