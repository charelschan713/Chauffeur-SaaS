-- 025_contact_passengers.sql

CREATE TABLE IF NOT EXISTS contact_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
    ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id)
    ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES passengers(id)
    ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  relationship VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, passenger_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_passengers_contact
  ON contact_passengers(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_passengers_passenger
  ON contact_passengers(passenger_id);
CREATE INDEX IF NOT EXISTS idx_contact_passengers_tenant
  ON contact_passengers(tenant_id);
