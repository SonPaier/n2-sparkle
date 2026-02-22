
-- Create protocols table
CREATE TABLE public.protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_nip TEXT,
  customer_address_id UUID REFERENCES public.customer_addresses(id),
  protocol_date TEXT NOT NULL,
  protocol_time TEXT,
  protocol_type TEXT NOT NULL DEFAULT 'completion',
  status TEXT NOT NULL DEFAULT 'completed',
  prepared_by TEXT,
  notes TEXT,
  customer_signature TEXT,
  photo_urls JSONB DEFAULT '[]'::jsonb,
  public_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique index on public_token
CREATE UNIQUE INDEX idx_protocols_public_token ON public.protocols(public_token);
CREATE INDEX idx_protocols_instance_id ON public.protocols(instance_id);
CREATE INDEX idx_protocols_customer_id ON public.protocols(customer_id);

-- Enable RLS
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin full access
CREATE POLICY "Admin/super_admin can manage protocols"
ON public.protocols FOR ALL
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Employee can select
CREATE POLICY "Employee can select protocols"
ON public.protocols FOR SELECT
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Public access by token (no auth required)
CREATE POLICY "Public can view protocol by token"
ON public.protocols FOR SELECT
USING (public_token IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_protocols_updated_at
BEFORE UPDATE ON public.protocols
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for protocol photos
INSERT INTO storage.buckets (id, name, public) VALUES ('protocol-photos', 'protocol-photos', true);

-- Storage policies for protocol-photos
CREATE POLICY "Protocol photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'protocol-photos');

CREATE POLICY "Authenticated users can upload protocol photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'protocol-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update protocol photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'protocol-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete protocol photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'protocol-photos' AND auth.role() = 'authenticated');

-- Add protocol_email_template to instances
ALTER TABLE public.instances ADD COLUMN protocol_email_template TEXT;
