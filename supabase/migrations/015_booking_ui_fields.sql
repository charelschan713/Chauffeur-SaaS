-- =====================
-- 补充bookings表显示字段
-- =====================
ALTER TABLE bookings
  -- Booker信息（Admin创建时手动填）
  ADD COLUMN IF NOT EXISTS booker_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS booker_email VARCHAR(200),
  ADD COLUMN IF NOT EXISTS booker_phone VARCHAR(50),

  -- 航班信息
  ADD COLUMN IF NOT EXISTS flight_number VARCHAR(20),

  -- 回程（关联）
  ADD COLUMN IF NOT EXISTS linked_booking_id UUID
    REFERENCES bookings(id),
  ADD COLUMN IF NOT EXISTS is_return_leg BOOLEAN DEFAULT FALSE;

-- =====================
-- 确保tenant_service_cities有所有字段
-- =====================
ALTER TABLE tenant_service_cities
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- =====================
-- 确保pricing_rules字段完整
-- =====================
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- =====================
-- 更新bookings视图（方便前端查询）
-- =====================
CREATE OR REPLACE VIEW booking_summary AS
SELECT
  b.id,
  b.booking_number,
  b.status AS booking_status,
  b.driver_status,
  b.payment_status,
  b.service_type,
  b.trip_type,
  b.vehicle_class,
  b.pickup_address,
  b.dropoff_address,
  b.pickup_datetime,
  b.pickup_timezone,
  b.duration_hours,
  b.passenger_name,
  b.passenger_phone,
  b.booker_name,
  b.booker_email,
  b.booker_phone,
  b.flight_number,
  b.passenger_count,
  b.special_requests,
  b.fare,
  b.toll,
  b.extras,
  b.surcharge_amount,
  b.surcharge_percentage,
  b.discount_type,
  b.discount_amount,
  b.total_price,
  b.currency,
  b.driver_fare,
  b.driver_toll,
  b.driver_extras,
  b.driver_total,
  b.charged_amount,
  b.refunded_amount,
  b.supplement_amount,
  b.credit_amount,
  b.is_transferred,
  b.tenant_id,
  b.original_tenant_id,
  b.passenger_id,
  b.driver_id,
  b.service_city_id,
  b.vehicle_type_id,
  b.created_at,
  b.updated_at,
  -- 服务城市
  sc.city_name,
  sc.timezone AS pickup_timezone_name,
  sc.currency AS city_currency,
  -- 司机
  dp.first_name AS driver_first_name,
  dp.last_name AS driver_last_name,
  dp.phone AS driver_phone,
  -- 车辆
  v.make AS vehicle_make,
  v.model AS vehicle_model,
  v.color AS vehicle_color,
  v.plate_number,
  -- 乘客
  pp.first_name AS passenger_first_name,
  pp.last_name AS passenger_last_name,
  pp.phone AS passenger_phone_profile
FROM bookings b
LEFT JOIN tenant_service_cities sc
  ON b.service_city_id = sc.id
LEFT JOIN drivers d
  ON b.driver_id = d.id
LEFT JOIN profiles dp
  ON d.user_id = dp.id
LEFT JOIN vehicles v
  ON d.id = v.driver_id AND v.is_active = TRUE
LEFT JOIN profiles pp
  ON b.passenger_id = pp.id;
