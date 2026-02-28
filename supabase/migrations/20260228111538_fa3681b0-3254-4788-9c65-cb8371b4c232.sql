
-- Add order_number column
ALTER TABLE public.calendar_items
ADD COLUMN order_number text;

-- Function to generate order number in format: [seq]/[MM]/[YYYY]
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  item_month text;
  item_year text;
  seq_num integer;
BEGIN
  -- Extract month and year from item_date (format: YYYY-MM-DD)
  item_month := LPAD(EXTRACT(MONTH FROM NEW.item_date::date)::text, 2, '0');
  item_year := EXTRACT(YEAR FROM NEW.item_date::date)::text;

  -- Count existing items in the same month/year/instance
  SELECT COUNT(*) + 1 INTO seq_num
  FROM public.calendar_items
  WHERE instance_id = NEW.instance_id
    AND EXTRACT(MONTH FROM item_date::date) = EXTRACT(MONTH FROM NEW.item_date::date)
    AND EXTRACT(YEAR FROM item_date::date) = EXTRACT(YEAR FROM NEW.item_date::date);

  NEW.order_number := seq_num || '/' || item_month || '/' || item_year;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger on insert
CREATE TRIGGER set_order_number
BEFORE INSERT ON public.calendar_items
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Backfill existing records
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY instance_id, EXTRACT(MONTH FROM item_date::date), EXTRACT(YEAR FROM item_date::date)
      ORDER BY created_at
    ) AS seq,
    LPAD(EXTRACT(MONTH FROM item_date::date)::text, 2, '0') AS m,
    EXTRACT(YEAR FROM item_date::date)::text AS y
  FROM public.calendar_items
)
UPDATE public.calendar_items ci
SET order_number = numbered.seq || '/' || numbered.m || '/' || numbered.y
FROM numbered
WHERE ci.id = numbered.id;
