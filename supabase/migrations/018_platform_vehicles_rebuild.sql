-- =====================
-- 1. 创建平台车辆库
-- =====================
CREATE TABLE IF NOT EXISTS platform_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(make, model)
);

-- =====================
-- 2. 重建租户车辆等级表
-- =====================
DROP TABLE IF EXISTS tenant_vehicle_type_vehicles CASCADE;
DROP TABLE IF EXISTS tenant_vehicle_types CASCADE;

CREATE TABLE tenant_vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
    ON DELETE CASCADE,
  type_name VARCHAR(100) NOT NULL,
  description TEXT,
  max_luggage INT NOT NULL DEFAULT 2,
  base_fare DECIMAL(10,2) NOT NULL DEFAULT 0,
  per_km_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  minimum_fare DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'AUD',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, type_name)
);

-- =====================
-- 3. 车辆等级关联表
-- =====================
CREATE TABLE tenant_vehicle_type_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
    ON DELETE CASCADE,
  vehicle_type_id UUID NOT NULL
    REFERENCES tenant_vehicle_types(id)
    ON DELETE CASCADE,
  platform_vehicle_id UUID NOT NULL
    REFERENCES platform_vehicles(id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 每辆车在同一租户下只能属于一个type
  UNIQUE(tenant_id, platform_vehicle_id)
);

-- =====================
-- 4. 司机车辆表更新
-- =====================
DO $$
BEGIN
  IF to_regclass('public.driver_vehicles') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE driver_vehicles
        ADD COLUMN IF NOT EXISTS platform_vehicle_id UUID
          REFERENCES platform_vehicles(id),
        ADD COLUMN IF NOT EXISTS match_status VARCHAR(20)
          DEFAULT 'UNMATCHED'
          CHECK (match_status IN (
            'MATCHED', 'UNMATCHED', 'PENDING_REVIEW'
          ))
    $sql$;
  END IF;
END $$;

-- =====================
-- 5. Bookings 表更新
-- =====================
DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS vehicle_type_id UUID
          REFERENCES tenant_vehicle_types(id)
    $sql$;
  END IF;
END $$;

-- =====================
-- 6. 索引
-- =====================
CREATE INDEX IF NOT EXISTS idx_platform_vehicles_active
  ON platform_vehicles(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_tenant
  ON tenant_vehicle_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_type_vehicles_type
  ON tenant_vehicle_type_vehicles(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_type_vehicles_tenant
  ON tenant_vehicle_type_vehicles(tenant_id);

-- =====================
-- 7. vehicle_requests 表
-- =====================
CREATE TABLE IF NOT EXISTS vehicle_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  requested_by_driver UUID REFERENCES profiles(id),
  tenant_id UUID REFERENCES tenants(id),
  status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 8. 预置平台车辆数据
-- =====================
INSERT INTO platform_vehicles (make, model) VALUES
  ('Mercedes-Benz', 'S-Class'),
  ('Mercedes-Benz', 'E-Class'),
  ('Mercedes-Benz', 'V-Class'),
  ('BMW', '7 Series'),
  ('BMW', '5 Series'),
  ('Audi', 'A8'),
  ('Audi', 'A6'),
  ('Rolls-Royce', 'Phantom'),
  ('Rolls-Royce', 'Ghost'),
  ('Bentley', 'Flying Spur'),
  ('Bentley', 'Mulsanne'),
  ('Lexus', 'LS'),
  ('Lexus', 'LM'),
  ('Toyota', 'Camry'),
  ('Toyota', 'HiAce'),
  ('Tesla', 'Model S'),
  ('Tesla', 'Model X'),
  ('Cadillac', 'Escalade'),
  ('Lincoln', 'Navigator'),
  ('Chrysler', '300')
ON CONFLICT (make, model) DO NOTHING;
