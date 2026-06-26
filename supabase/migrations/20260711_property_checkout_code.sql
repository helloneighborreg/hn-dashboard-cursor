-- Property-level guest checkout codes (e.g. 123ABC).
-- One code per property; guests enter it on the public checkout page.

ALTER TABLE property_details
	ADD COLUMN IF NOT EXISTS checkout_code text;

CREATE UNIQUE INDEX IF NOT EXISTS property_details_checkout_code_unique
	ON property_details (checkout_code)
	WHERE checkout_code IS NOT NULL AND checkout_code != '';

ALTER TABLE property_details
	DROP CONSTRAINT IF EXISTS property_details_checkout_code_format;

ALTER TABLE property_details
	ADD CONSTRAINT property_details_checkout_code_format
	CHECK (checkout_code IS NULL OR checkout_code = '' OR checkout_code ~ '^\d{3}[A-Z]{3}$');

-- guest_checkouts tracks confirmations per property + date; code lookup is via property_details.
DROP INDEX IF EXISTS guest_checkouts_code_unique;

ALTER TABLE guest_checkouts
	DROP CONSTRAINT IF EXISTS guest_checkouts_code_format;

ALTER TABLE guest_checkouts
	ALTER COLUMN code DROP NOT NULL;
