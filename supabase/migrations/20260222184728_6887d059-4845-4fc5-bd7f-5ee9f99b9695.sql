
-- 1a. Add short_name and reservation_phone to instances
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS reservation_phone text;

-- 1b. Add calendar_item_id to customer_sms_notifications
ALTER TABLE public.customer_sms_notifications ADD COLUMN IF NOT EXISTS calendar_item_id uuid;
