-- =====================
-- 租户Connection表
-- =====================
CREATE TABLE IF NOT EXISTS tenant_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  connection_status VARCHAR(20) DEFAULT 'PENDING',
  requester_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, receiver_id)
);

-- =====================
-- 订单转单表
-- =====================
CREATE TABLE IF NOT EXISTS booking_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  from_tenant_id UUID REFERENCES tenants(id),
  to_tenant_id UUID REFERENCES tenants(id),
  transfer_status VARCHAR(20) DEFAULT 'PENDING',
  from_percentage DECIMAL DEFAULT 30,
  to_percentage DECIMAL DEFAULT 70,
  transfer_note TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 更新bookings表
-- =====================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS original_tenant_id UUID
    REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS is_transferred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transfer_id UUID
    REFERENCES booking_transfers(id);

-- =====================
-- RLS
-- =====================
ALTER TABLE tenant_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_connections"
  ON tenant_connections FOR ALL
  USING (
    requester_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    OR
    receiver_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_own_transfers"
  ON booking_transfers FOR ALL
  USING (
    from_tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    OR
    to_tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
