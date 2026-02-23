-- =====================
-- 重构 pricing_rules 表
-- =====================
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'POINT_TO_POINT',
  ADD COLUMN IF NOT EXISTS base_fare DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_km DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_minute DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_fare DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_hours DECIMAL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS included_km_per_hour DECIMAL,
  ADD COLUMN IF NOT EXISTS extra_km_rate DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_rules JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS service_city_id UUID REFERENCES tenant_service_cities(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================
-- 取消政策表
-- =====================
CREATE TABLE IF NOT EXISTS tenant_cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL DEFAULT 'Default Policy',
  is_default BOOLEAN DEFAULT FALSE,
  tiers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 折扣/优惠码表
-- =====================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  discount_type VARCHAR(20) NOT NULL,
  discount_value DECIMAL NOT NULL,
  applies_to VARCHAR(20) DEFAULT 'FARE_ONLY',
  min_order_amount DECIMAL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  applicable_vehicle_classes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- =====================
-- 会员等级表
-- =====================
CREATE TABLE IF NOT EXISTS membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  min_spend DECIMAL DEFAULT 0,
  discount_type VARCHAR(20) DEFAULT 'PERCENTAGE',
  discount_value DECIMAL DEFAULT 0,
  applies_to VARCHAR(20) DEFAULT 'FARE_ONLY',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 乘客会员状态
-- =====================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS membership_tier_id UUID REFERENCES membership_tiers(id),
  ADD COLUMN IF NOT EXISTS total_spend DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(200);

-- =====================
-- RLS
-- =====================
ALTER TABLE tenant_cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_cancellation_policies" ON tenant_cancellation_policies
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "tenant_own_promo_codes" ON promo_codes
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "tenant_own_membership_tiers" ON membership_tiers
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "passenger_read_promo" ON promo_codes
  FOR SELECT USING (is_active = true);
