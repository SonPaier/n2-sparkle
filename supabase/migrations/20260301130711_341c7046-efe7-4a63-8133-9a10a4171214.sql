
-- Create sms_logs table for SMS history
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id),
  calendar_item_id uuid REFERENCES public.calendar_items(id),
  phone text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin can manage
CREATE POLICY "Admin/super_admin can manage sms_logs"
ON public.sms_logs
FOR ALL
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Employee can select
CREATE POLICY "Employee can select sms_logs"
ON public.sms_logs
FOR SELECT
USING (
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Index for quick lookup by instance
CREATE INDEX idx_sms_logs_instance_id ON public.sms_logs(instance_id);
CREATE INDEX idx_sms_logs_calendar_item_id ON public.sms_logs(calendar_item_id);
