ALTER TABLE public.calendar_items ADD COLUMN work_started_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.calendar_items ADD COLUMN work_ended_at timestamp with time zone DEFAULT NULL;