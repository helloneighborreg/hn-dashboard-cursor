-- Fix API access for supplies tables (permission denied for service_role)

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
