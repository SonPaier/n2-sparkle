
-- Create sms_notification_templates table
CREATE TABLE public.sms_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  name TEXT NOT NULL,
  description TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  sms_template TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage sms_notification_templates"
  ON public.sms_notification_templates FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select sms_notification_templates"
  ON public.sms_notification_templates FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_sms_notification_templates_updated_at
  BEFORE UPDATE ON public.sms_notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create customer_sms_notifications table
CREATE TABLE public.customer_sms_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  notification_template_id UUID NOT NULL REFERENCES public.sms_notification_templates(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_type TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  months_after INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_sms_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage customer_sms_notifications"
  ON public.customer_sms_notifications FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select customer_sms_notifications"
  ON public.customer_sms_notifications FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_customer_sms_notifications_updated_at
  BEFORE UPDATE ON public.customer_sms_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add notification_template_id to unified_services
ALTER TABLE public.unified_services
  ADD COLUMN notification_template_id UUID REFERENCES public.sms_notification_templates(id);
