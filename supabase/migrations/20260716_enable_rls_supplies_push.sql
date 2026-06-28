-- Enable RLS on supplies + push tables (defense-in-depth).
--
-- The dashboard connects with service_role (BYPASSRLS), so app behavior is unchanged.
-- With no policies defined, anon/authenticated get zero row access even if table grants exist.

alter table public.supply_products enable row level security;
alter table public.supply_inventory enable row level security;
alter table public.supply_orders enable row level security;
alter table public.supply_order_items enable row level security;
alter table public.push_subscriptions enable row level security;

grant all on table public.supply_products to service_role;
grant all on table public.supply_inventory to service_role;
grant all on table public.supply_orders to service_role;
grant all on table public.supply_order_items to service_role;
grant all on table public.push_subscriptions to service_role;
