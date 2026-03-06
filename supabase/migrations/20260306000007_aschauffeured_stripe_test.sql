-- Stripe columns for tenant_settings (idempotent)
-- Keys are inserted manually via Supabase dashboard or env — not stored in git.
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS stripe_secret_key         TEXT,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
