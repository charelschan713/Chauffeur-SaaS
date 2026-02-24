-- 042_tenant_vehicle_types_waiting_minutes.sql
ALTER TABLE tenant_vehicle_types
  ADD COLUMN IF NOT EXISTS per_minute_rate DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiting_minutes_free INT DEFAULT 0;
