
ALTER TABLE public.calendar_items
ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
ADD COLUMN customer_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL;
