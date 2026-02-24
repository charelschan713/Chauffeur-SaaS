-- 029_booking_transfers.sql

-- 1. bookings 表加临时车型覆盖字段
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS override_platform_vehicle_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transfer_note TEXT DEFAULT NULL;

-- 2. 转单记录表
CREATE TABLE IF NOT EXISTS booking_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_tenant_id UUID NOT NULL REFERENCES tenants(id),
  to_tenant_id UUID NOT NULL REFERENCES tenants(id),
  status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  override_platform_vehicle_ids UUID[] DEFAULT NULL,
  transfer_note TEXT,
  response_note TEXT,
  assigned_vehicle_id UUID DEFAULT NULL REFERENCES tenant_vehicles(id),
  assigned_driver_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_booking ON booking_transfers(booking_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON booking_transfers(from_tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON booking_transfers(to_tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON booking_transfers(status);

-- 3. booking_status constraint 更新 (column is booking_status, not status)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_status_check
  CHECK (booking_status IN (
    'PENDING', 'CONFIRMED', 'TRANSFER_PENDING', 'TRANSFERRED',
    'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  ));
