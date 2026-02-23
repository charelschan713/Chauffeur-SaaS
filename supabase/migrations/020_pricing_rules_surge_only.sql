-- 020_pricing_rules_surge_only.sql

-- ensure surge multiplier exists for rule-level adjustment
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS surge_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0;

-- remove legacy pricing payload fields so pricing_rules only stores scope + surge
ALTER TABLE pricing_rules
  DROP COLUMN IF EXISTS price_per_km,
  DROP COLUMN IF EXISTS price_per_minute,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS minimum_hours,
  DROP COLUMN IF EXISTS included_km_per_hour,
  DROP COLUMN IF EXISTS extra_km_rate,
  DROP COLUMN IF EXISTS surcharge_rules,
  DROP COLUMN IF EXISTS name;
