-- 023_billing_methods.sql

-- 1. tenant_vehicle_types 加入新字段
ALTER TABLE tenant_vehicle_types
  ADD COLUMN IF NOT EXISTS per_minute_rate
    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_km_per_hour
    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_km_rate
    DECIMAL(10,2) DEFAULT 0;

-- 2. bookings 加入计费记录
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS billing_method
    VARCHAR(10) DEFAULT NULL
    CHECK (billing_method IN ('KM', 'DT')),
  ADD COLUMN IF NOT EXISTS actual_distance_km
    DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes
    INT DEFAULT NULL;

-- 3. 确认字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenant_vehicle_types'
ORDER BY ordinal_position;
