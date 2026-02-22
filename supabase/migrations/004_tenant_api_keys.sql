-- 给tenants表加api_keys字段（加密JSON存储）
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
  api_keys JSONB DEFAULT '{}'::jsonb;

-- 加密扩展（用于Key存储）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- api_keys结构说明（注释，不执行）
-- {
--   "stripe_secret_key": "encrypted_value",
--   "stripe_webhook_secret": "encrypted_value",
--   "resend_api_key": "encrypted_value",
--   "twilio_account_sid": "encrypted_value",
--   "twilio_auth_token": "encrypted_value",
--   "twilio_from_number": "encrypted_value"
-- }

-- RLS：api_keys字段只有TENANT_ADMIN可读写
-- 乘客和司机查询时不返回api_keys
CREATE OR REPLACE VIEW tenants_public AS
SELECT 
  id, name, slug, logo_url, domain,
  status, commission_rate,
  subscription_plan, subscription_status,
  created_at, updated_at
FROM tenants;
