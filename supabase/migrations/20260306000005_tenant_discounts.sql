-- Tenant discount / promo code system
CREATE TABLE IF NOT EXISTS public.tenant_discounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identity
  name                  text NOT NULL,
  code                  text,                          -- NULL = auto-apply (no code required)
  description           text,

  -- Discount value
  type                  text NOT NULL DEFAULT 'PERCENTAGE'
                          CHECK (type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  value                 numeric(10,2) NOT NULL,        -- % or minor units
  max_discount_minor    integer,                       -- cap: e.g. 2000 = $20.00 max off

  -- Eligibility
  applies_to            text NOT NULL DEFAULT 'ALL'
                          CHECK (applies_to IN ('ALL', 'NEW_CLIENTS', 'SPECIFIC_CLIENTS')),
  service_type_ids      uuid[],                        -- NULL = all service types
  min_fare_minor        integer DEFAULT 0,             -- minimum fare to qualify

  -- Validity
  start_at              timestamptz,
  end_at                timestamptz,
  active                boolean NOT NULL DEFAULT true,

  -- Usage limits
  max_uses              integer,                       -- NULL = unlimited
  max_uses_per_customer integer DEFAULT 1,
  used_count            integer NOT NULL DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS public.tenant_discount_uses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id    uuid NOT NULL REFERENCES public.tenant_discounts(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL,
  customer_id    uuid,                                 -- NULL for guest
  booking_id     uuid,
  discount_minor integer NOT NULL DEFAULT 0,
  used_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_discounts_tenant    ON public.tenant_discounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_discounts_code      ON public.tenant_discounts(tenant_id, code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_discounts_active    ON public.tenant_discounts(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_discount_uses_discount     ON public.tenant_discount_uses(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_uses_customer     ON public.tenant_discount_uses(customer_id);

-- Unique code per tenant (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_discounts_code_unique
  ON public.tenant_discounts(tenant_id, LOWER(code)) WHERE code IS NOT NULL;

-- RLS
ALTER TABLE public.tenant_discounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_discount_uses   ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all_discounts" ON public.tenant_discounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_discount_uses" ON public.tenant_discount_uses
  FOR ALL TO service_role USING (true) WITH CHECK (true);
