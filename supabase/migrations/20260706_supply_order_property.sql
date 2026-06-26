-- Bill-to property on supply orders (invoice payee).

ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS property_id text;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS property_name text;
