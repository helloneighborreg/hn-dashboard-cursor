-- Supplies catalog, inventory, and orders

CREATE TABLE IF NOT EXISTS supply_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  image_url text,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  sales_tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  sale_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES supply_products(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT 'Warehouse',
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, location)
);

CREATE TABLE IF NOT EXISTS supply_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'submitted',
  location text NOT NULL DEFAULT 'Warehouse',
  notes text,
  created_by text,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES supply_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES supply_products(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  sales_tax_percent numeric(5,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supply_products_category ON supply_products(category);
CREATE INDEX IF NOT EXISTS idx_supply_inventory_product ON supply_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_supply_inventory_location ON supply_inventory(location);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_order ON supply_order_items(order_id);

INSERT INTO supply_products (title, category, cost, sales_tax_percent, sale_price) VALUES
  ('AA Batteries', 'Batteries', 0, 0, 0),
  ('AAA Batteries', 'Batteries', 0, 0, 0),
  ('All Purpose Cleaner', 'Cleaning', 0, 0, 0),
  ('Body Wash Refill', 'Personal Care', 0, 0, 0),
  ('Bona Mop Pad', 'Cleaning', 0, 0, 0),
  ('Bottled Water', 'Beverages', 0, 0, 0),
  ('Coffee Pods', 'Kitchen', 0, 0, 0),
  ('Conditioner Refill', 'Personal Care', 0, 0, 0),
  ('Cooking Spray', 'Kitchen', 0, 0, 0),
  ('Coffee Creamer', 'Kitchen', 0, 0, 0),
  ('Dish Scrubber', 'Cleaning', 0, 0, 0),
  ('Dish Washing Liquid Refill', 'Dish', 0, 0, 0),
  ('Face Tissue', 'Paper Products', 0, 0, 0),
  ('Hand Soap Refill', 'Personal Care', 0, 0, 0),
  ('Large Trash Liners', 'Trash & Bags', 0, 0, 0),
  ('Paper Towels', 'Paper Products', 0, 0, 0),
  ('Pens', 'Office', 0, 0, 0),
  ('Pepper', 'Seasoning', 0, 0, 0),
  ('Salt', 'Seasoning', 0, 0, 0),
  ('Shampoo Refill', 'Personal Care', 0, 0, 0),
  ('Shower Curtain Liner', 'Bathroom', 0, 0, 0),
  ('Small Trash Liners', 'Trash & Bags', 0, 0, 0),
  ('Stain Remover', 'Cleaning', 0, 0, 0),
  ('Sticky Notes', 'Office', 0, 0, 0),
  ('Sugar Packets', 'Kitchen', 0, 0, 0),
  ('Toilet Bowl Cleaner', 'Cleaning', 0, 0, 0),
  ('Toilet Paper', 'Paper Products', 0, 0, 0)
ON CONFLICT DO NOTHING;

-- API access for server-side Supabase client (service_role)
grant all on table public.supply_products to service_role;
grant all on table public.supply_inventory to service_role;
grant all on table public.supply_orders to service_role;
grant all on table public.supply_order_items to service_role;
grant all on table public.supply_products to postgres;
grant all on table public.supply_inventory to postgres;
grant all on table public.supply_orders to postgres;
grant all on table public.supply_order_items to postgres;
alter table public.supply_products disable row level security;
alter table public.supply_inventory disable row level security;
alter table public.supply_orders disable row level security;
alter table public.supply_order_items disable row level security;
