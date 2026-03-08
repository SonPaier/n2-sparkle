INSERT INTO public.instance_features (instance_id, feature_key, enabled)
VALUES ('c6300bdc-5070-4599-8143-06926578a424', 'employees', true)
ON CONFLICT (instance_id, feature_key) DO NOTHING;