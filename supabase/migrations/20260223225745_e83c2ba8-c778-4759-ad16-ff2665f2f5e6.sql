
-- Tabela ustawień fakturowania per instancja
CREATE TABLE public.invoicing_settings (
  instance_id uuid PRIMARY KEY REFERENCES public.instances(id),
  provider text, -- 'fakturownia' | 'ifirma' | null
  provider_config jsonb DEFAULT '{}'::jsonb,
  default_vat_rate integer DEFAULT 23,
  default_payment_days integer DEFAULT 14,
  default_document_kind text DEFAULT 'vat',
  default_currency text DEFAULT 'PLN',
  auto_send_email boolean DEFAULT false,
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoicing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage invoicing_settings"
ON public.invoicing_settings FOR ALL
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Employee can select invoicing_settings"
ON public.invoicing_settings FOR SELECT
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Tabela faktur
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id),
  calendar_item_id uuid REFERENCES public.calendar_items(id),
  customer_id uuid REFERENCES public.customers(id),
  provider text NOT NULL,
  external_invoice_id text,
  external_client_id text,
  invoice_number text,
  kind text DEFAULT 'vat',
  status text DEFAULT 'draft',
  issue_date text,
  sell_date text,
  payment_to text,
  buyer_name text,
  buyer_tax_no text,
  buyer_email text,
  positions jsonb DEFAULT '[]'::jsonb,
  total_gross numeric,
  currency text DEFAULT 'PLN',
  pdf_url text,
  oid text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage invoices"
ON public.invoices FOR ALL
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Employee can select invoices"
ON public.invoices FOR SELECT
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Kolumna payment_status w calendar_items
ALTER TABLE public.calendar_items
  ADD COLUMN payment_status text DEFAULT 'not_invoiced';

-- Triggery updated_at
CREATE TRIGGER update_invoicing_settings_updated_at
BEFORE UPDATE ON public.invoicing_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
