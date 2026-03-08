-- Customer email verification
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_otp text,
  ADD COLUMN IF NOT EXISTS email_otp_expires_at timestamptz;
