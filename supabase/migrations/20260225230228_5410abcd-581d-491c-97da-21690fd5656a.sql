
-- Create reminder_types table
CREATE TABLE public.reminder_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage reminder_types"
  ON public.reminder_types FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin/employee/super_admin can select reminder_types"
  ON public.reminder_types FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_reminder_types_updated_at
  BEFORE UPDATE ON public.reminder_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create reminders table
CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  reminder_type_id uuid REFERENCES public.reminder_types(id) ON DELETE SET NULL,
  deadline text NOT NULL,
  days_before integer NOT NULL DEFAULT 7,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_user_id uuid,
  notes text,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_type text, -- 'monthly' | 'weekly'
  recurring_value integer, -- day of month (1-31) or day of week (0-6)
  status text NOT NULL DEFAULT 'todo', -- 'todo' | 'done' | 'cancelled'
  notification_sent boolean NOT NULL DEFAULT false,
  notification_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage reminders"
  ON public.reminders FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin/employee/super_admin can select reminders"
  ON public.reminders FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for reminders
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
