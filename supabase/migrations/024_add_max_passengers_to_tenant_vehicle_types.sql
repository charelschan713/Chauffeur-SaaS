-- 024_add_max_passengers_to_tenant_vehicle_types.sql

ALTER TABLE tenant_vehicle_types
ADD COLUMN IF NOT EXISTS max_passengers INT DEFAULT 4;
