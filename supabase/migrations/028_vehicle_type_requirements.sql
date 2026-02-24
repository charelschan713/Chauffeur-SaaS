-- 028_vehicle_type_requirements.sql

CREATE TABLE IF NOT EXISTS vehicle_type_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_vehicle_type_id UUID NOT NULL REFERENCES tenant_vehicle_types(id) ON DELETE CASCADE,
  platform_vehicle_id UUID NOT NULL REFERENCES platform_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_vehicle_type_id, platform_vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_vt_requirements_type
  ON vehicle_type_requirements(tenant_vehicle_type_id);

CREATE INDEX IF NOT EXISTS idx_vt_requirements_platform
  ON vehicle_type_requirements(platform_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vt_requirements_tenant
  ON vehicle_type_requirements(tenant_id);
