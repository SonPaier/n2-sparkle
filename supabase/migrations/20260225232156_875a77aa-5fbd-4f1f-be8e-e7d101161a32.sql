ALTER TABLE public.reminders ADD COLUMN notify_customer_email boolean NOT NULL DEFAULT false;
ALTER TABLE public.reminders ADD COLUMN notify_customer_sms boolean NOT NULL DEFAULT false;