CREATE TABLE IF NOT EXISTS public.tenant_loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tier VARCHAR(32) NOT NULL,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 999,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_loyalty_tiers_tier_chk CHECK (tier IN ('STANDARD','SILVER','GOLD','PLATINUM','VIP')),
  CONSTRAINT tenant_loyalty_tiers_discount_chk CHECK (discount_pct >= 0 AND discount_pct <= 100),
  CONSTRAINT tenant_loyalty_tiers_unique UNIQUE (tenant_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_tenant_loyalty_tiers_tenant ON public.tenant_loyalty_tiers(tenant_id);
