-- Guest checkout confirmation codes (public guest flow + cleaner notification)
-- One code per property + checkout date (shared by the guest checking out that day).

CREATE TABLE IF NOT EXISTS guest_checkouts (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	code text NOT NULL,
	task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
	reservation_id text,
	property_id text NOT NULL,
	property_name text NOT NULL,
	guest_name text,
	checkout_date date NOT NULL,
	confirmed_at timestamptz,
	enjoyed_stay boolean,
	rating smallint CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
	feedback text,
	notified_cleaner_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT guest_checkouts_code_format CHECK (code ~ '^\d{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_checkouts_code_unique ON guest_checkouts(code);
CREATE UNIQUE INDEX IF NOT EXISTS guest_checkouts_property_date_unique
	ON guest_checkouts(property_id, checkout_date);
CREATE INDEX IF NOT EXISTS guest_checkouts_confirmed_at_idx ON guest_checkouts(confirmed_at);

grant all on table public.guest_checkouts to service_role;
