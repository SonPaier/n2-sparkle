
CREATE TABLE public.sms_payment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  sms_body text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (instance_id, template_type)
);

ALTER TABLE public.sms_payment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage sms_payment_templates"
ON public.sms_payment_templates
FOR ALL
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Employee can select sms_payment_templates"
ON public.sms_payment_templates
FOR SELECT
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE TRIGGER update_sms_payment_templates_updated_at
BEFORE UPDATE ON public.sms_payment_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
