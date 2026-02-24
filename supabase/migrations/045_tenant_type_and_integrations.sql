-- 045_tenant_type_and_integrations.sql
-- Tenant type + subscription + tenant-level Stripe/SMS settings

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(20) DEFAULT 'STANDARD'
    CHECK (tenant_type IN ('STANDARD', 'PREMIUM'));

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'ACTIVE'
    CHECK (subscription_status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL')),
  ADD COLUMN IF NOT EXISTS subscription_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS next_billing_date DATE;

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS sms_account_sid TEXT,
  ADD COLUMN IF NOT EXISTS sms_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_from_number TEXT,
  ADD COLUMN IF NOT EXISTS sms_sender_type VARCHAR(20) DEFAULT 'PHONE'
    CHECK (sms_sender_type IN ('PHONE', 'SENDER_ID')),
  ADD COLUMN IF NOT EXISTS sms_sender_id VARCHAR(11);

UPDATE tenants
SET tenant_type = 'PREMIUM'
WHERE slug = 'aschauffeured';
