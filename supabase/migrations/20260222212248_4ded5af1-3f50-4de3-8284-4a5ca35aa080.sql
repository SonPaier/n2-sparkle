
-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Admin or super_admin can select calendar_columns" ON public.calendar_columns;

-- Create new SELECT policy that includes employee
CREATE POLICY "Admin/employee/super_admin can select calendar_columns"
  ON public.calendar_columns
  FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
