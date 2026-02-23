-- 019_pricing_rules_cleanup.sql

-- 1) add vehicle_type_id column if missing
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID
    REFERENCES tenant_vehicle_types(id)
    ON DELETE CASCADE;

-- 2) drop legacy vehicle_class column
ALTER TABLE pricing_rules
  DROP COLUMN IF EXISTS vehicle_class;

-- 3) drop legacy base pricing fields moved to tenant_vehicle_types
ALTER TABLE pricing_rules
  DROP COLUMN IF EXISTS base_fare,
  DROP COLUMN IF EXISTS per_km_rate,
  DROP COLUMN IF EXISTS hourly_rate,
  DROP COLUMN IF EXISTS minimum_fare,
  DROP COLUMN IF EXISTS per_minute_rate;
