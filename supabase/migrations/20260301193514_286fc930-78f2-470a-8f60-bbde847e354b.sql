-- Allow employees to update calendar_items (status, assigned_employee_ids, media)
CREATE POLICY "Employees can update calendar_items"
ON public.calendar_items
FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));