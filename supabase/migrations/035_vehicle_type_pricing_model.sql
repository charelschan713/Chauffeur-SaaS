-- 035_vehicle_type_pricing_model.sql

ALTER TABLE tenant_vehicle_types
ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(20)
  DEFAULT 'STRAIGHT'
  CHECK (pricing_model IN ('STRAIGHT', 'INCLUDED')),
ADD COLUMN IF NOT EXISTS included_km INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS included_minutes INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS extra_km_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_minute_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS waiting_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hourly_included_km INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS min_booking_hours INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS free_waiting_standard INT DEFAULT 15,
ADD COLUMN IF NOT EXISTS free_waiting_domestic INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS free_waiting_international INT DEFAULT 60,
ADD COLUMN IF NOT EXISTS baby_seat_infant_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS baby_seat_convertible_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS baby_seat_booster_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_baby_seats INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS waypoint_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS waypoint_fee_type VARCHAR(20)
  DEFAULT 'FIXED'
  CHECK (waypoint_fee_type IN ('FIXED', 'PERCENTAGE'));

-- Cleanup: remove deprecated hourly included km column after replacement
ALTER TABLE tenant_vehicle_types
DROP COLUMN IF EXISTS included_km_per_hour;
