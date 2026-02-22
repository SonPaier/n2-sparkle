
-- Create calendar_items table
CREATE TABLE public.calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  column_id uuid REFERENCES public.calendar_columns(id) ON DELETE SET NULL,
  title text NOT NULL,
  customer_name text,
  customer_phone text,
  customer_email text,
  item_date text NOT NULL,
  end_date text,
  start_time text NOT NULL,
  end_time text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  admin_notes text,
  price numeric,
  assigned_employee_ids text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create breaks table
CREATE TABLE public.breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.calendar_columns(id) ON DELETE CASCADE,
  break_date text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_items
CREATE POLICY "Admin or super_admin can select calendar_items"
  ON public.calendar_items FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin or super_admin can manage calendar_items"
  ON public.calendar_items FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- RLS policies for breaks
CREATE POLICY "Admin or super_admin can select breaks"
  ON public.breaks FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin or super_admin can manage breaks"
  ON public.breaks FOR ALL
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Enable realtime for calendar_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_items;

-- Trigger for updated_at on calendar_items
CREATE TRIGGER update_calendar_items_updated_at
  BEFORE UPDATE ON public.calendar_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
