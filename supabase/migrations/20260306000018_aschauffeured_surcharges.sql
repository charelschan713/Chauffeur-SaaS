-- Ensure tables exist (idempotent)
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

CREATE INDEX IF NOT EXISTS idx_time_surcharges_tenant ON tenant_time_surcharges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_holidays_tenant ON tenant_holidays(tenant_id);

-- Seed default surcharge rules for aschauffeured tenant

-- 1. Time surcharges
INSERT INTO tenant_time_surcharges (tenant_id, name, day_type, start_time, end_time, surcharge_type, surcharge_value, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Late Night / Early Morning', 'ALL',  '23:00', '05:00', 'PERCENTAGE', 20, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Weekend Surcharge',          'WEEKEND','00:00','23:59', 'PERCENTAGE', 10, false)
ON CONFLICT DO NOTHING;

-- 2. Australian public holidays (recurring annually by MM-DD)
INSERT INTO tenant_holidays (tenant_id, name, date, recurring, surcharge_type, surcharge_value, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'New Year''s Day',          '2026-01-01', true, 'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Australia Day',             '2026-01-26', true, 'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Good Friday',               '2026-04-03', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Easter Saturday',           '2026-04-04', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Easter Sunday',             '2026-04-05', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Easter Monday',             '2026-04-06', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Anzac Day',                 '2026-04-25', true, 'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'King''s Birthday (NSW)',    '2026-06-08', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bank Holiday (NSW)',        '2026-08-03', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Labour Day (NSW)',          '2026-10-05', false,'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Christmas Day',             '2026-12-25', true, 'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Boxing Day',                '2026-12-26', true, 'PERCENTAGE', 25, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'New Year''s Eve (after 6pm)','2026-12-31',true, 'PERCENTAGE', 25, true)
ON CONFLICT DO NOTHING;
