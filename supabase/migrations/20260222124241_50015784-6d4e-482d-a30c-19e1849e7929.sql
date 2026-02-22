
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  name TEXT NOT NULL,
  short_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  company TEXT,
  nip TEXT,
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  source TEXT DEFAULT 'manual',
  billing_street TEXT,
  billing_street_line2 TEXT,
  billing_city TEXT,
  billing_postal_code TEXT,
  billing_region TEXT,
  billing_country_code TEXT,
  country_code TEXT,
  default_currency TEXT DEFAULT 'PLN',
  vat_eu_number TEXT,
  sales_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, phone)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee/super_admin can select customers"
  ON public.customers FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/super_admin can manage customers"
  ON public.customers FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customers_instance_id ON public.customers(instance_id);

-- Create customer_addresses table
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  name TEXT NOT NULL,
  street TEXT,
  street_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  region TEXT,
  country_code TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  contact_person TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee/super_admin can select customer_addresses"
  ON public.customer_addresses FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/super_admin can manage customer_addresses"
  ON public.customer_addresses FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER update_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_instance_id ON public.customer_addresses(instance_id);
