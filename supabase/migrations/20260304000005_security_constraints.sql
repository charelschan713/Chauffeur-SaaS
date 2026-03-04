-- Fix 9: custom_domain must be globally unique across tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS custom_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain
  ON public.tenants (custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Fix 2 (future-proofing): customer email unique per tenant
-- Prevents same email registering twice under the same tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_email
  ON public.customers (tenant_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;
