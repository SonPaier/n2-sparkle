
-- Create audit log table for time entries
CREATE TABLE public.time_entry_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid,
  employee_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  entry_date text NOT NULL,
  change_type text NOT NULL,
  changed_by uuid,
  old_start_time timestamptz,
  old_end_time timestamptz,
  old_total_minutes integer,
  new_start_time timestamptz,
  new_end_time timestamptz,
  new_total_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entry_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin can view all audit logs for their instance
CREATE POLICY "Admin/super_admin can select time_entry_audit_log"
  ON public.time_entry_audit_log FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Employee can view own audit logs
CREATE POLICY "Employee can select own time_entry_audit_log"
  ON public.time_entry_audit_log FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.linked_user_id = auth.uid() AND e.instance_id = time_entry_audit_log.instance_id
    )
  );

-- Trigger function (SECURITY DEFINER to bypass RLS for INSERT)
CREATE OR REPLACE FUNCTION public.log_time_entry_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.time_entry_audit_log (
      time_entry_id, employee_id, instance_id, entry_date, change_type, changed_by,
      new_start_time, new_end_time, new_total_minutes
    ) VALUES (
      NEW.id, NEW.employee_id, NEW.instance_id, NEW.entry_date, 'create', auth.uid(),
      NEW.start_time, NEW.end_time, NEW.total_minutes
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if relevant fields changed
    IF OLD.start_time IS DISTINCT FROM NEW.start_time
       OR OLD.end_time IS DISTINCT FROM NEW.end_time
       OR OLD.total_minutes IS DISTINCT FROM NEW.total_minutes THEN
      INSERT INTO public.time_entry_audit_log (
        time_entry_id, employee_id, instance_id, entry_date, change_type, changed_by,
        old_start_time, old_end_time, old_total_minutes,
        new_start_time, new_end_time, new_total_minutes
      ) VALUES (
        NEW.id, NEW.employee_id, NEW.instance_id, NEW.entry_date, 'update', auth.uid(),
        OLD.start_time, OLD.end_time, OLD.total_minutes,
        NEW.start_time, NEW.end_time, NEW.total_minutes
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_entry_audit_log (
      time_entry_id, employee_id, instance_id, entry_date, change_type, changed_by,
      old_start_time, old_end_time, old_total_minutes
    ) VALUES (
      OLD.id, OLD.employee_id, OLD.instance_id, OLD.entry_date, 'delete', auth.uid(),
      OLD.start_time, OLD.end_time, OLD.total_minutes
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to time_entries
CREATE TRIGGER trg_time_entry_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_time_entry_changes();
