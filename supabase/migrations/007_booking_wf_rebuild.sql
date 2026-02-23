-- =====================
-- 更新 bookings 表
-- =====================

-- 新增字段
ALTER TABLE bookings

  -- 订单编号
  ADD COLUMN IF NOT EXISTS booking_number VARCHAR(20) UNIQUE,

  -- 服务相关
  ADD COLUMN IF NOT EXISTS service_city_id UUID REFERENCES tenant_service_cities(id),
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'POINT_TO_POINT',
  ADD COLUMN IF NOT EXISTS trip_type VARCHAR(20) DEFAULT 'ONE_WAY',
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES tenant_vehicle_types(id),

  -- 时间相关
  ADD COLUMN IF NOT EXISTS pickup_timezone VARCHAR(100) DEFAULT 'Australia/Sydney',
  ADD COLUMN IF NOT EXISTS return_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_hours DECIMAL,
  ADD COLUMN IF NOT EXISTS created_timezone VARCHAR(100),

  -- 地址相关
  ADD COLUMN IF NOT EXISTS waypoints JSONB DEFAULT '[]',

  -- 乘客相关（区分booker和passenger）
  ADD COLUMN IF NOT EXISTS booker_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS passenger_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS passenger_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS passenger_email VARCHAR(200),

  -- 订单状态拆分
  ADD COLUMN IF NOT EXISTS driver_status VARCHAR(50) DEFAULT 'UNASSIGNED',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID',

  -- 金额明细
  ADD COLUMN IF NOT EXISTS fare DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toll DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_percentage DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL DEFAULT 0,

  -- 折扣
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_value DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_applies_to VARCHAR(20) DEFAULT 'FARE_ONLY',

  -- 司机收入
  ADD COLUMN IF NOT EXISTS driver_fare DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_toll DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_extras DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_total DECIMAL DEFAULT 0,

  -- Hourly Charter
  ADD COLUMN IF NOT EXISTS included_km_per_hour DECIMAL,
  ADD COLUMN IF NOT EXISTS actual_km DECIMAL,
  ADD COLUMN IF NOT EXISTS extra_km_rate DECIMAL,

  -- 支付相关
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS charged_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplement_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_amount DECIMAL DEFAULT 0,

  -- Admin相关
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirm_token VARCHAR(200),
  ADD COLUMN IF NOT EXISTS confirm_token_expires_at TIMESTAMPTZ,

  -- 修改历史
  ADD COLUMN IF NOT EXISTS modify_history JSONB DEFAULT '[]',

  -- 转单相关
  ADD COLUMN IF NOT EXISTS is_transferred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transfer_id UUID;

-- booking_number自动生成函数
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number VARCHAR(20);
  counter INT;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM bookings;
  new_number := 'BK' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(counter::TEXT, 4, '0');
  NEW.booking_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_number
  BEFORE INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.booking_number IS NULL)
  EXECUTE FUNCTION generate_booking_number();

-- =====================
-- booking_status_logs（状态变更记录）
-- =====================
CREATE TABLE IF NOT EXISTS booking_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  booking_status VARCHAR(50),
  driver_status VARCHAR(50),
  payment_status VARCHAR(50),
  changed_by UUID REFERENCES profiles(id),
  changed_by_role VARCHAR(50),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- booking_payments（支付记录）
-- =====================
CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  payment_type VARCHAR(50) NOT NULL,
  amount DECIMAL NOT NULL,
  currency VARCHAR(10) DEFAULT 'AUD',
  stripe_payment_intent_id VARCHAR(200),
  stripe_payment_method_id VARCHAR(200),
  status VARCHAR(50) DEFAULT 'PENDING',
  note TEXT,
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- payment_type枚举：
-- CHARGE（初始扣款）
-- SUPPLEMENT（补收）
-- CREDIT_NOTE（退款）
-- REFUND（取消退款）
-- NO_SHOW_CHARGE（No Show收费）

-- =====================
-- RLS
-- =====================
ALTER TABLE booking_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_status_logs" ON booking_status_logs
  FOR ALL USING (
    booking_id IN (
      SELECT id FROM bookings
      WHERE tenant_id = (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "tenant_own_payments" ON booking_payments
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
