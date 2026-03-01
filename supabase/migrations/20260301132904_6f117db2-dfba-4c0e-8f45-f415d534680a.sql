-- Allow employees to manage their own time entries
CREATE POLICY "Employee can manage own time_entries"
ON public.time_entries
FOR ALL
USING (
  has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  AND employee_id IN (
    SELECT id FROM public.employees WHERE linked_user_id = auth.uid() AND instance_id = time_entries.instance_id
  )
)
WITH CHECK (
  has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  AND employee_id IN (
    SELECT id FROM public.employees WHERE linked_user_id = auth.uid() AND instance_id = time_entries.instance_id
  )
);

-- Allow employees to manage their own days off
CREATE POLICY "Employee can manage own employee_days_off"
ON public.employee_days_off
FOR ALL
USING (
  has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  AND employee_id IN (
    SELECT id FROM public.employees WHERE linked_user_id = auth.uid() AND instance_id = employee_days_off.instance_id
  )
)
WITH CHECK (
  has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  AND employee_id IN (
    SELECT id FROM public.employees WHERE linked_user_id = auth.uid() AND instance_id = employee_days_off.instance_id
  )
);