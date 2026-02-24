-- 026_quote_surcharges.sql

CREATE TABLE IF NOT EXISTS tenant_time_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  day_type VARCHAR(20) DEFAULT 'ALL' CHECK (day_type IN ('WEEKDAY', 'WEEKEND', 'ALL')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  surcharge_type VARCHAR(20) DEFAULT 'PERCENTAGE' CHECK (surcharge_type IN ('FIXED', 'PERCENTAGE')),
  surcharge_value DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN DEFAULT true,
  surcharge_type VARCHAR(20) DEFAULT 'PERCENTAGE' CHECK (surcharge_type IN ('FIXED', 'PERCENTAGE')),
  surcharge_value DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('FIXED', 'PERCENTAGE')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_fare DECIMAL(10,2) DEFAULT 0,
  max_uses INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_time_surcharges_tenant ON tenant_time_surcharges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_holidays_tenant ON tenant_holidays(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_tenant ON promo_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(tenant_id, code);
