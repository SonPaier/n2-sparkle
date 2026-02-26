
ALTER TABLE public.instances
  ADD COLUMN bank_name text DEFAULT NULL,
  ADD COLUMN bank_account_number text DEFAULT NULL,
  ADD COLUMN blik_phone text DEFAULT NULL;
