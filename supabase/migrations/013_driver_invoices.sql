-- =====================
-- 更新 drivers 表（ABN相关）
-- =====================
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS abn VARCHAR(20),
  ADD COLUMN IF NOT EXISTS abn_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS abn_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_gst_registered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bank_bsb VARCHAR(10),
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(10) DEFAULT 'INV';

-- =====================
-- 司机Invoice表
-- =====================
CREATE TABLE IF NOT EXISTS driver_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_status VARCHAR(20) DEFAULT 'DRAFT',
  invoice_period_from DATE,
  invoice_period_to DATE,
  invoice_subtotal DECIMAL DEFAULT 0,
  invoice_gst DECIMAL DEFAULT 0,
  invoice_total DECIMAL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'AUD',
  note TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Invoice明细表
-- =====================
CREATE TABLE IF NOT EXISTS driver_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES driver_invoices(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),
  description TEXT,
  driver_fare DECIMAL DEFAULT 0,
  driver_toll DECIMAL DEFAULT 0,
  driver_extras DECIMAL DEFAULT 0,
  driver_subtotal DECIMAL DEFAULT 0,
  service_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Invoice编号自动生成函数
-- =====================
CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_driver_id UUID,
  p_prefix VARCHAR DEFAULT 'INV'
)
RETURNS VARCHAR AS $$
DECLARE
  v_count INT;
  v_year VARCHAR;
  v_number VARCHAR;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM driver_invoices
  WHERE driver_id = p_driver_id;

  v_year := TO_CHAR(NOW(), 'YYYY');
  v_number := p_prefix || '-' || v_year || '-' ||
    LPAD(v_count::TEXT, 4, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- RLS
-- =====================
ALTER TABLE driver_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_own_invoices"
  ON driver_invoices FOR ALL
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "driver_own_invoice_items"
  ON driver_invoice_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM driver_invoices
      WHERE driver_id IN (
        SELECT id FROM drivers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "tenant_view_invoices"
  ON driver_invoices FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_view_invoice_items"
  ON driver_invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM driver_invoices
      WHERE tenant_id = (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
