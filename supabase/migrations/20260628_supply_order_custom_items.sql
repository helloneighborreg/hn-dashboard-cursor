-- Custom line items on supply orders (items not in the catalog)

ALTER TABLE supply_order_items
  ADD COLUMN IF NOT EXISTS custom_title text;

ALTER TABLE supply_order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE supply_order_items
  DROP CONSTRAINT IF EXISTS supply_order_items_product_or_custom_check;

ALTER TABLE supply_order_items
  ADD CONSTRAINT supply_order_items_product_or_custom_check
  CHECK (
    (product_id IS NOT NULL AND (custom_title IS NULL OR btrim(custom_title) = ''))
    OR (product_id IS NULL AND custom_title IS NOT NULL AND btrim(custom_title) <> '')
  );
