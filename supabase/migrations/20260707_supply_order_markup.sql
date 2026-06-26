-- Order-level markup percent (baked into invoice totals).

ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS markup_percent numeric NOT NULL DEFAULT 0;
