-- Add missing columns to customer_passengers
ALTER TABLE public.customer_passengers
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS relationship  text,
  ADD COLUMN IF NOT EXISTS is_default    boolean DEFAULT false;
