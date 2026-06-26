-- Switch guest checkout codes from per-task to per property + checkout date.
-- Run this if you already applied 20260708_guest_checkouts.sql with the task_id unique index.

DROP INDEX IF EXISTS guest_checkouts_task_id_unique;

-- Remove duplicate property+date rows (keep the earliest code per unit/day).
DELETE FROM guest_checkouts a
USING guest_checkouts b
WHERE a.property_id IS NOT NULL
	AND a.checkout_date IS NOT NULL
	AND a.property_id = b.property_id
	AND a.checkout_date = b.checkout_date
	AND a.created_at > b.created_at;

ALTER TABLE guest_checkouts
	ALTER COLUMN property_id SET NOT NULL,
	ALTER COLUMN checkout_date SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guest_checkouts_property_date_unique
	ON guest_checkouts(property_id, checkout_date);
