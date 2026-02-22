ALTER TABLE public.protocols 
  ADD COLUMN calendar_item_id uuid REFERENCES public.calendar_items(id) ON DELETE SET NULL;