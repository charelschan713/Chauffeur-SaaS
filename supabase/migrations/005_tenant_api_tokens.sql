CREATE TABLE tenant_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_tokens" ON tenant_api_tokens
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
