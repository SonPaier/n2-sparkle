
-- Allow employees to insert calendar_item_services
CREATE POLICY "Employee can insert calendar_item_services"
ON public.calendar_item_services FOR INSERT TO authenticated
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- Allow employees to delete calendar_item_services
CREATE POLICY "Employee can delete calendar_item_services"
ON public.calendar_item_services FOR DELETE TO authenticated
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
