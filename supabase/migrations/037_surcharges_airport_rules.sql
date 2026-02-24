-- 037_surcharges_airport_rules.sql

-- Time Surcharges
CREATE TABLE IF NOT EXISTS tenant_time_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  surcharge_type VARCHAR(20) DEFAULT 'PERCENTAGE' CHECK (surcharge_type IN ('PERCENTAGE', 'FIXED')),
  surcharge_value DECIMAL(10,2) NOT NULL,
  applies_to VARCHAR(20) DEFAULT 'ALL' CHECK (applies_to IN ('ALL', 'P2P', 'AIRPORT', 'HOURLY')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_time_surcharges
  ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) DEFAULT 'ALL';

-- Holiday Surcharges
CREATE TABLE IF NOT EXISTS tenant_holiday_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  date DATE,
  is_recurring BOOLEAN DEFAULT true,
  surcharge_type VARCHAR(20) DEFAULT 'PERCENTAGE' CHECK (surcharge_type IN ('PERCENTAGE', 'FIXED')),
  surcharge_value DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Surcharges
CREATE TABLE IF NOT EXISTS tenant_event_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  surcharge_type VARCHAR(20) DEFAULT 'PERCENTAGE' CHECK (surcharge_type IN ('PERCENTAGE', 'FIXED')),
  surcharge_value DECIMAL(10,2) NOT NULL,
  one_way_rate DECIMAL(10,2) DEFAULT 100,
  return_rate DECIMAL(10,2) DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airport Rules
CREATE TABLE IF NOT EXISTS tenant_airport_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  place_id VARCHAR(255),
  address_keywords TEXT[],
  terminal_type VARCHAR(20) DEFAULT 'DOMESTIC' CHECK (terminal_type IN ('DOMESTIC', 'INTERNATIONAL', 'BOTH')),
  parking_fee DECIMAL(10,2) DEFAULT 0,
  free_waiting_minutes INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
