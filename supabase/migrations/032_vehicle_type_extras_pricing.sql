-- 032_vehicle_type_extras_pricing.sql
-- Waypoint fee + baby seat pricing for tenant vehicle types

ALTER TABLE tenant_vehicle_types
  ADD COLUMN IF NOT EXISTS waypoint_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baby_seat_infant_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baby_seat_convertible_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baby_seat_booster_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_baby_seats INT DEFAULT NULL;
