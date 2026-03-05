
-- Create push_subscriptions table
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL DEFAULT '',
  auth text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage own push_subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin/super_admin can select all (for sending)
CREATE POLICY "Admin/super_admin can select push_subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
