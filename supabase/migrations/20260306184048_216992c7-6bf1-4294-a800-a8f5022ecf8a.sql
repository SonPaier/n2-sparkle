CREATE POLICY "Employee can update calendar_item_services"
ON public.calendar_item_services
FOR UPDATE
TO authenticated
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));