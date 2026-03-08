-- Update existing project statuses from old values to new values
UPDATE public.projects SET status = 'not_started' WHERE status = 'active';
-- Default for new projects should be not_started
ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'not_started';
