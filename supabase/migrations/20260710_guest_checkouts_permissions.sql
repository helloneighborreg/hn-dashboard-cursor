-- Fix API access for guest checkout codes (permission denied for service_role)

grant all on table public.guest_checkouts to service_role;
