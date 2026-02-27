
-- Customer categories table (separate from service categories)
CREATE TABLE public.customer_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee/super_admin can select customer_categories"
  ON public.customer_categories FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR
    has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/super_admin can manage customer_categories"
  ON public.customer_categories FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER update_customer_categories_updated_at
  BEFORE UPDATE ON public.customer_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customer category assignments (many-to-many)
CREATE TABLE public.customer_category_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.customer_categories(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, category_id)
);

ALTER TABLE public.customer_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee/super_admin can select customer_category_assignments"
  ON public.customer_category_assignments FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR
    has_instance_role(auth.uid(), 'employee'::app_role, instance_id) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/super_admin can manage customer_category_assignments"
  ON public.customer_category_assignments FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );
