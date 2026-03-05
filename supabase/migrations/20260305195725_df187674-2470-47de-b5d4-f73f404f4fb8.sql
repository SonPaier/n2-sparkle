
CREATE OR REPLACE FUNCTION public.get_instance_admin_user_ids(_instance_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.instance_id = _instance_id
    AND ur.role = 'admin'
$$;
