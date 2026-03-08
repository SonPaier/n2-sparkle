
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  title TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES public.customers(id),
  customer_address_id UUID REFERENCES public.customer_addresses(id),
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage projects"
ON public.projects FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select projects"
ON public.projects FOR SELECT
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add project_id and stage_number to calendar_items
ALTER TABLE public.calendar_items ADD COLUMN project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.calendar_items ADD COLUMN stage_number INTEGER;

-- Make date/time nullable for project stages without dates
ALTER TABLE public.calendar_items ALTER COLUMN item_date DROP NOT NULL;
ALTER TABLE public.calendar_items ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.calendar_items ALTER COLUMN end_time DROP NOT NULL;

-- Update generate_order_number trigger to handle null item_date
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  item_month text;
  item_year text;
  seq_num integer;
BEGIN
  -- Skip order number generation if item_date is null
  IF NEW.item_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract month and year from item_date (format: YYYY-MM-DD)
  item_month := LPAD(EXTRACT(MONTH FROM NEW.item_date::date)::text, 2, '0');
  item_year := EXTRACT(YEAR FROM NEW.item_date::date)::text;

  -- Count existing items in the same month/year/instance
  SELECT COUNT(*) + 1 INTO seq_num
  FROM public.calendar_items
  WHERE instance_id = NEW.instance_id
    AND item_date IS NOT NULL
    AND EXTRACT(MONTH FROM item_date::date) = EXTRACT(MONTH FROM NEW.item_date::date)
    AND EXTRACT(YEAR FROM item_date::date) = EXTRACT(YEAR FROM NEW.item_date::date);

  NEW.order_number := seq_num || '/' || item_month || '/' || item_year;
  RETURN NEW;
END;
$function$;
