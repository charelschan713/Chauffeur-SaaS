-- 039_booking_status_and_driver_invitations.sql
-- Pack #54

-- 1) Expand booking_status enum/check list and remove deprecated values.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_status_check
  CHECK (
    booking_status IN (
      'PENDING',
      'CONFIRMED',
      'ASSIGNED',
      'IN_PROGRESS',
      'JOB_DONE',
      'FULFILLED',
      'TRANSFER_PENDING',
      'TRANSFERRED',
      'CANCELLED'
    )
  );

-- Cleanup deprecated statuses to keep schema/data unambiguous.
UPDATE bookings
SET booking_status = 'FULFILLED'
WHERE booking_status = 'COMPLETED';

UPDATE bookings
SET booking_status = 'JOB_DONE'
WHERE booking_status = 'NO_SHOW';

-- 2) Driver invitation table.
CREATE TABLE IF NOT EXISTS driver_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(50),
  invited_by UUID REFERENCES profiles(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_invitations_tenant_status
  ON driver_invitations(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_driver_invitations_token
  ON driver_invitations(token);
