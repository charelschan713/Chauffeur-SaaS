-- 041_tenant_theme.sql
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(10) DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS primary_foreground VARCHAR(7) DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS sidebar_bg VARCHAR(7) DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS sidebar_fg VARCHAR(7) DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS card_bg VARCHAR(7) DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#000000';

INSERT INTO tenant_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

UPDATE tenant_settings
SET theme_mode = 'dark',
    primary_color = '#D6B57A',
    primary_foreground = '#000000',
    sidebar_bg = '#0A0E18',
    sidebar_fg = '#E5E7EB',
    card_bg = '#0B0F1A',
    accent_color = '#D6B57A',
    updated_at = NOW()
WHERE tenant_id = (
  SELECT id FROM tenants WHERE slug = 'aschauffeured' LIMIT 1
);
