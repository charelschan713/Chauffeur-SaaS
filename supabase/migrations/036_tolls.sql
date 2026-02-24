-- 036_tolls.sql

-- Tenant vehicle type tolls setting
ALTER TABLE tenant_vehicle_types
ADD COLUMN IF NOT EXISTS include_tolls BOOLEAN DEFAULT true;

-- Bookings tolls fields
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS toll_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS toll_estimated BOOLEAN DEFAULT true;
