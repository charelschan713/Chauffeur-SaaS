ALTER TABLE tenant_service_cities
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;

-- Default ordering by current alphabetical order for existing rows
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY name ASC) - 1 AS rn
  FROM tenant_service_cities
)
UPDATE tenant_service_cities c
SET display_order = r.rn
FROM ranked r
WHERE c.id = r.id;
