
-- Add lat/lng columns to instances for company HQ location
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS address_lat double precision;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS address_lng double precision;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS address_street text;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS address_postal_code text;
