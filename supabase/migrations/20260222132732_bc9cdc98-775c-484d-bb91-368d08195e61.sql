
-- ==========================================
-- EMPLOYEES TABLE
-- ==========================================
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  hourly_rate NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage employees"
  ON public.employees FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select employees"
  ON public.employees FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- TIME_ENTRIES TABLE
-- ==========================================
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  entry_number INTEGER NOT NULL DEFAULT 1,
  entry_type TEXT NOT NULL DEFAULT 'manual',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  total_minutes INTEGER,
  is_auto_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage time_entries"
  ON public.time_entries FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select time_entries"
  ON public.time_entries FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to compute total_minutes
CREATE OR REPLACE FUNCTION public.compute_time_entry_total_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.total_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  ELSE
    NEW.total_minutes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER compute_time_entry_minutes
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.compute_time_entry_total_minutes();

-- ==========================================
-- EMPLOYEE_DAYS_OFF TABLE
-- ==========================================
CREATE TABLE public.employee_days_off (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  day_off_type TEXT NOT NULL DEFAULT 'vacation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_days_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage employee_days_off"
  ON public.employee_days_off FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select employee_days_off"
  ON public.employee_days_off FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ==========================================
-- WORKERS_SETTINGS TABLE
-- ==========================================
CREATE TABLE public.workers_settings (
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE PRIMARY KEY,
  start_stop_enabled BOOLEAN NOT NULL DEFAULT true,
  overtime_enabled BOOLEAN NOT NULL DEFAULT false,
  standard_hours_per_day INTEGER NOT NULL DEFAULT 8,
  report_frequency TEXT NOT NULL DEFAULT 'monthly',
  time_calculation_mode TEXT NOT NULL DEFAULT 'start_to_stop'
);

ALTER TABLE public.workers_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/super_admin can manage workers_settings"
  ON public.workers_settings FOR ALL
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employee can select workers_settings"
  ON public.workers_settings FOR SELECT
  USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ==========================================
-- STORAGE BUCKET
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true);

CREATE POLICY "Anyone can view employee photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-photos');

CREATE POLICY "Admin can upload employee photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Admin can update employee photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'employee-photos');

CREATE POLICY "Admin can delete employee photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'employee-photos');
