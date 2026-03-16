-- Booking change requests for admin/customer modifications
CREATE TABLE IF NOT EXISTS booking_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  proposed_by_role TEXT NOT NULL,
  proposed_by_id UUID NOT NULL,
  change_payload JSONB NOT NULL,
  old_snapshot JSONB NOT NULL,
  new_snapshot JSONB NOT NULL,
  price_delta_minor BIGINT,
  status TEXT NOT NULL DEFAULT 'PENDING_CUSTOMER_APPROVAL' CHECK (status IN (
    'PENDING_CUSTOMER_APPROVAL','PENDING_ADMIN_REVIEW','APPROVED','REJECTED','CANCELLED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_booking_change_requests_tenant ON booking_change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_change_requests_booking ON booking_change_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_change_requests_status ON booking_change_requests(status);
