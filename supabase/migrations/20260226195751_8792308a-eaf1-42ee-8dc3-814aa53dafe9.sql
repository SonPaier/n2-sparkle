ALTER TABLE public.reminders ADD COLUMN assigned_employee_id uuid;
ALTER TABLE public.reminders ADD COLUMN visible_for_employee boolean NOT NULL DEFAULT false;