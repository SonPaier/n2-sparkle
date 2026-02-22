
-- Add new columns to instances
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS contact_person text;

-- Create calendar_columns table
CREATE TABLE public.calendar_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_columns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin or super_admin can select calendar_columns"
  ON public.calendar_columns FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin or super_admin can manage calendar_columns"
  ON public.calendar_columns FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Update trigger
CREATE TRIGGER update_calendar_columns_updated_at
  BEFORE UPDATE ON public.calendar_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Admin can update their own instance
CREATE POLICY "Admin can update own instance"
  ON public.instances FOR UPDATE
  USING (has_instance_role(auth.uid(), 'admin'::app_role, id));

-- Storage bucket for instance logos
INSERT INTO storage.buckets (id, name, public) VALUES ('instance-logos', 'instance-logos', true);

-- Storage policies
CREATE POLICY "Instance logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instance-logos');

CREATE POLICY "Admins can upload instance logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'instance-logos');

CREATE POLICY "Admins can update instance logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'instance-logos');

CREATE POLICY "Admins can delete instance logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'instance-logos');
