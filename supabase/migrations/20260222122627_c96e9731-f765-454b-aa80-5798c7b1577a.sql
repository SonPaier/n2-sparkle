
-- Create unified_categories table
CREATE TABLE public.unified_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  prices_are_net BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unified_services table
CREATE TABLE public.unified_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  category_id UUID REFERENCES public.unified_categories(id),
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  price NUMERIC(10,2),
  duration_minutes INTEGER,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  prices_are_net BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  unit TEXT NOT NULL DEFAULT 'szt',
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unified_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_services ENABLE ROW LEVEL SECURITY;

-- RLS for unified_categories
CREATE POLICY "Admin/employee/super_admin can select categories"
  ON public.unified_categories FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/super_admin can manage categories"
  ON public.unified_categories FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- RLS for unified_services
CREATE POLICY "Admin/employee/super_admin can select services"
  ON public.unified_services FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/super_admin can manage services"
  ON public.unified_services FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Triggers for updated_at
CREATE TRIGGER update_unified_categories_updated_at
  BEFORE UPDATE ON public.unified_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_unified_services_updated_at
  BEFORE UPDATE ON public.unified_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_unified_categories_instance ON public.unified_categories(instance_id);
CREATE INDEX idx_unified_services_instance ON public.unified_services(instance_id);
CREATE INDEX idx_unified_services_category ON public.unified_services(category_id);
