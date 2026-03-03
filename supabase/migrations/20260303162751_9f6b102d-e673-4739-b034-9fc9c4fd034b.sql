
CREATE TABLE public.dashboard_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  view_mode text NOT NULL DEFAULT 'day',
  visible_sections jsonb NOT NULL DEFAULT '{"orders": true, "reminders": true, "payments": true}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, instance_id)
);

ALTER TABLE public.dashboard_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dashboard settings"
  ON public.dashboard_user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_dashboard_user_settings_updated_at
  BEFORE UPDATE ON public.dashboard_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
