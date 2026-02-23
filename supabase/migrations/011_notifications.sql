-- =====================
-- 通知模版表
-- =====================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  template_id VARCHAR(100) NOT NULL,
  notification_channel VARCHAR(20) NOT NULL, -- EMAIL/SMS/PUSH
  recipient_type VARCHAR(20) NOT NULL,        -- BOOKER/PASSENGER/DRIVER/TENANT
  subject VARCHAR(200),                       -- 邮件主题
  body TEXT NOT NULL,                         -- 模版内容
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,           -- 平台默认模版
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, template_id, notification_channel, recipient_type)
);

-- =====================
-- 通知记录表
-- =====================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  booking_id UUID REFERENCES bookings(id),
  notification_type VARCHAR(100) NOT NULL,
  notification_channel VARCHAR(20) NOT NULL,
  recipient_type VARCHAR(20) NOT NULL,
  recipient_id UUID,
  recipient_email VARCHAR(200),
  recipient_phone VARCHAR(50),
  subject VARCHAR(200),
  body TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING/SENT/FAILED
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Push Token表（司机App）
-- =====================
CREATE TABLE IF NOT EXISTS driver_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  push_token VARCHAR(500) NOT NULL,
  device_type VARCHAR(20) DEFAULT 'ios', -- ios/android
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, push_token)
);

-- =====================
-- RLS
-- =====================
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_templates"
  ON notification_templates FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_own_logs"
  ON notification_logs FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "driver_own_push_tokens"
  ON driver_push_tokens FOR ALL
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );
