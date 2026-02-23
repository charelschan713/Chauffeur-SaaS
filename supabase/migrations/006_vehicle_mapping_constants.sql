-- =====================
-- 系统常量字典
-- =====================
CREATE TABLE system_constants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  default_name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, code)
);

-- 预填标准数据
INSERT INTO system_constants (category, code, default_name, description, sort_order)
VALUES
  -- 平台车型
  ('VEHICLE_CLASS', 'BUSINESS', 'Business Class', 'Comfortable business sedans', 1),
  ('VEHICLE_CLASS', 'FIRST', 'First Class', 'Premium luxury vehicles', 2),
  ('VEHICLE_CLASS', 'VAN', 'Van / MPV', 'Spacious vans up to 8 passengers', 3),
  ('VEHICLE_CLASS', 'ELECTRIC', 'Electric', 'Eco-friendly electric vehicles', 4),

  -- 服务类型
  ('SERVICE_TYPE', 'POINT_TO_POINT', 'Point to Point', 'Fixed route from A to B', 1),
  ('SERVICE_TYPE', 'HOURLY_CHARTER', 'Hourly Charter', 'Flexible hourly booking', 2),

  -- 行程类型
  ('TRIP_TYPE', 'ONE_WAY', 'One Way', 'Single journey', 1),
  ('TRIP_TYPE', 'RETURN', 'Return Trip', 'Return journey included', 2),

  -- 订单状态
  ('BOOKING_STATUS', 'PENDING', 'Pending', 'Awaiting admin confirmation', 1),
  ('BOOKING_STATUS', 'CONFIRMED', 'Confirmed', 'Booking confirmed', 2),
  ('BOOKING_STATUS', 'IN_PROGRESS', 'In Progress', 'Trip in progress', 3),
  ('BOOKING_STATUS', 'COMPLETED', 'Completed', 'Trip completed', 4),
  ('BOOKING_STATUS', 'CANCELLED', 'Cancelled', 'Booking cancelled', 5),
  ('BOOKING_STATUS', 'NO_SHOW', 'No Show', 'Passenger did not show', 6),

  -- 司机子状态
  ('DRIVER_STATUS', 'UNASSIGNED', 'Unassigned', 'No driver assigned', 1),
  ('DRIVER_STATUS', 'ASSIGNED', 'Assigned', 'Driver assigned, pending acceptance', 2),
  ('DRIVER_STATUS', 'ACCEPTED', 'Accepted', 'Driver accepted the job', 3),
  ('DRIVER_STATUS', 'DECLINED', 'Declined', 'Driver declined the job', 4),
  ('DRIVER_STATUS', 'ON_THE_WAY', 'On The Way', 'Driver is on the way', 5),
  ('DRIVER_STATUS', 'ARRIVED', 'Arrived', 'Driver has arrived', 6),
  ('DRIVER_STATUS', 'PASSENGER_ON_BOARD', 'Passenger On Board', 'Passenger in vehicle', 7),
  ('DRIVER_STATUS', 'JOB_DONE', 'Job Done', 'Trip completed by driver', 8),

  -- 支付状态
  ('PAYMENT_STATUS', 'UNPAID', 'Unpaid', 'Payment not yet collected', 1),
  ('PAYMENT_STATUS', 'PAID', 'Paid', 'Payment collected', 2),
  ('PAYMENT_STATUS', 'PARTIALLY_REFUNDED', 'Partially Refunded', 'Partial refund issued', 3),
  ('PAYMENT_STATUS', 'REFUNDED', 'Refunded', 'Full refund issued', 4),
  ('PAYMENT_STATUS', 'NO_SHOW_CHARGED', 'No Show Charged', 'No show fee collected', 5);

-- =====================
-- 租户自定义名称
-- =====================
CREATE TABLE tenant_constant_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  constant_id UUID REFERENCES system_constants(id) ON DELETE CASCADE,
  custom_name VARCHAR(100) NOT NULL,
  custom_description TEXT,
  language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, constant_id, language)
);

-- =====================
-- 平台标准车型表
-- =====================
CREATE TABLE platform_vehicle_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  default_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_vehicle_classes (code, default_name, description, icon, sort_order)
VALUES
  ('BUSINESS', 'Business Class', 'Comfortable business sedans', '🚗', 1),
  ('FIRST', 'First Class', 'Premium luxury vehicles', '🏆', 2),
  ('VAN', 'Van / MPV', 'Spacious vans up to 8 passengers', '🚐', 3),
  ('ELECTRIC', 'Electric', 'Eco-friendly electric vehicles', '⚡', 4);

-- =====================
-- 租户自定义车型
-- =====================
CREATE TABLE tenant_vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  allowed_platform_classes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- =====================
-- 租户服务城市
-- =====================
CREATE TABLE tenant_service_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  city_name VARCHAR(100) NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  timezone VARCHAR(100) NOT NULL,
  currency VARCHAR(10) DEFAULT 'AUD',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, city_name)
);

-- =====================
-- vehicles表更新
-- =====================
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS platform_class VARCHAR(50) REFERENCES platform_vehicle_classes(code),
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES tenant_vehicle_types(id);

-- =====================
-- RLS
-- =====================
ALTER TABLE system_constants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_constant_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_vehicle_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_service_cities ENABLE ROW LEVEL SECURITY;

-- system_constants 所有人可读
CREATE POLICY "public_read_system_constants" ON system_constants
  FOR SELECT USING (true);

-- platform_vehicle_classes 所有人可读
CREATE POLICY "public_read_platform_classes" ON platform_vehicle_classes
  FOR SELECT USING (true);

-- tenant_constant_labels 租户管理自己的
CREATE POLICY "tenant_own_constant_labels" ON tenant_constant_labels
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- tenant_vehicle_types 租户管理自己的
CREATE POLICY "tenant_own_vehicle_types" ON tenant_vehicle_types
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- tenant_service_cities 租户管理自己的
CREATE POLICY "tenant_own_service_cities" ON tenant_service_cities
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
