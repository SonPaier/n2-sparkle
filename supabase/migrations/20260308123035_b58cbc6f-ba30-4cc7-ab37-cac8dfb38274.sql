
CREATE TABLE public.instance_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, feature_key)
);

ALTER TABLE public.instance_features ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin full access
CREATE POLICY "Admin/super_admin can manage instance_features"
ON public.instance_features FOR ALL TO authenticated
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Employees can read
CREATE POLICY "Employee can select instance_features"
ON public.instance_features FOR SELECT TO authenticated
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
