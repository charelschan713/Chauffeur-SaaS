-- 030_vehicle_type_extras.sql

CREATE TABLE IF NOT EXISTS vehicle_type_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_vehicle_type_id UUID NOT NULL
    REFERENCES tenant_vehicle_types(id)
    ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(20) DEFAULT 'OTHER'
    CHECK (category IN (
      'BABY_SEAT', 'AMENITY', 'OTHER'
    )),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_quantity INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extras_vehicle_type
  ON vehicle_type_extras(tenant_vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_extras_tenant
  ON vehicle_type_extras(tenant_id);
