
-- Create calendar_item_services table
CREATE TABLE public.calendar_item_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_item_id UUID NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.unified_services(id),
  custom_price NUMERIC NULL,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_calendar_item_services_calendar_item_id ON public.calendar_item_services(calendar_item_id);
CREATE INDEX idx_calendar_item_services_instance_id ON public.calendar_item_services(instance_id);

-- Enable RLS
ALTER TABLE public.calendar_item_services ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin/super_admin can manage calendar_item_services"
ON public.calendar_item_services
FOR ALL
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Employee can select calendar_item_services"
ON public.calendar_item_services
FOR SELECT
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
