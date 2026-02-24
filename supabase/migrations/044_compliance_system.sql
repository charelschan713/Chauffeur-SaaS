CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('TENANT','DRIVER','VEHICLE')),
  entity_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'BUSINESS_LICENSE','COMPANY_INSURANCE','COMPANY_REGISTRATION',
    'DRIVER_LICENSE','BACKGROUND_CHECK','WORK_VISA',
    'VEHICLE_REGISTRATION','VEHICLE_INSURANCE','VEHICLE_INSPECTION'
  )),
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  expires_at DATE,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_entity ON compliance_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tenant ON compliance_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_documents(status);
CREATE INDEX IF NOT EXISTS idx_compliance_expires ON compliance_documents(expires_at);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20) DEFAULT 'PENDING' CHECK (compliance_status IN ('PENDING','APPROVED','SUSPENDED','EXPIRED'));
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20) DEFAULT 'PENDING' CHECK (compliance_status IN ('PENDING','APPROVED','SUSPENDED','EXPIRED'));
ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20) DEFAULT 'PENDING' CHECK (compliance_status IN ('PENDING','APPROVED','SUSPENDED','EXPIRED'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO NOTHING;
