-- Allow employees to insert protocols
CREATE POLICY "Employee can insert protocols"
ON public.protocols
FOR INSERT
WITH CHECK (
  has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow employees to update protocols they created or protocols in their instance
CREATE POLICY "Employee can update protocols"
ON public.protocols
FOR UPDATE
USING (
  has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);