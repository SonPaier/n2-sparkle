
CREATE TABLE public.employee_calendar_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  column_ids uuid[] NOT NULL DEFAULT '{}',
  visible_fields jsonb NOT NULL DEFAULT '{"customer_name": true, "customer_phone": true, "admin_notes": true, "price": true, "address": true}'::jsonb,
  allowed_actions jsonb NOT NULL DEFAULT '{"add_item": true, "edit_item": true, "delete_item": true, "change_time": true, "change_column": true}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_calendar_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage employee_calendar_configs"
ON public.employee_calendar_configs
FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select own employee_calendar_configs"
ON public.employee_calendar_configs
FOR SELECT
USING (auth.uid() = user_id);

CREATE TRIGGER update_employee_calendar_configs_updated_at
BEFORE UPDATE ON public.employee_calendar_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
