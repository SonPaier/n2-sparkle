ALTER TABLE public.employees ADD COLUMN linked_user_id uuid;

COMMENT ON COLUMN public.employees.linked_user_id IS 'Links employee record to auth user for employee dashboard features';