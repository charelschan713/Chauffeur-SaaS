-- =====================
-- profiles表更新（Stripe相关）
-- =====================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS total_spend DECIMAL DEFAULT 0;

-- =====================
-- booking_payments表（已在#18创建，补充字段）
-- =====================
ALTER TABLE booking_payments
  ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS stripe_refund_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- =====================
-- confirm_tokens表（Admin替客户下单用）
-- =====================
CREATE TABLE IF NOT EXISTS booking_confirm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  token VARCHAR(200) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE booking_confirm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_confirm_tokens"
  ON booking_confirm_tokens FOR ALL
  USING (true);
