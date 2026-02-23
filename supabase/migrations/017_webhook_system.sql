-- Webhook配置表
CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
    ON DELETE CASCADE,
  webhook_name VARCHAR(100) NOT NULL,
  webhook_url VARCHAR(500) NOT NULL,
  secret_key VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  events TEXT[] NOT NULL DEFAULT '{}',
  last_triggered_at TIMESTAMPTZ,
  last_status_code INT,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook投递日志
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES tenant_webhooks(id)
    ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  duration_ms INT,
  success BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant
  ON tenant_webhooks(tenant_id);
CREATE INDEX idx_webhook_deliveries_webhook
  ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_tenant
  ON webhook_deliveries(tenant_id);
