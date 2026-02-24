-- 033_schema_alignment_drivers_vehicles_booking_status.sql

-- 1) drivers table add profile/contact fields
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 2) tenant_vehicles add platform vehicle link
ALTER TABLE tenant_vehicles
ADD COLUMN IF NOT EXISTS platform_vehicle_id UUID DEFAULT NULL;

-- 3) booking_status constraint include transfer statuses
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_status_check
  CHECK (booking_status IN (
    'PENDING',
    'CONFIRMED',
    'TRANSFER_PENDING',
    'TRANSFERRED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ));
