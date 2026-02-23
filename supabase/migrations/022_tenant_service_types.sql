-- 022_tenant_service_types.sql

CREATE TABLE IF NOT EXISTS tenant_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_type VARCHAR(30) NOT NULL CHECK (base_type IN ('POINT_TO_POINT', 'HOURLY_CHARTER')),
  surcharge_type VARCHAR(20) DEFAULT 'FIXED' CHECK (surcharge_type IN ('FIXED', 'PERCENTAGE')),
  surcharge_value DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_types_tenant ON tenant_service_types(tenant_id);
