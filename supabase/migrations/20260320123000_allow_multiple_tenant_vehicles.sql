-- Allow multiple vehicles per tenant for same platform_vehicle_id
-- Drop unique constraint on (tenant_id, platform_vehicle_id) and instead enforce unique rego per tenant (when provided)

ALTER TABLE public.tenant_vehicles
  DROP CONSTRAINT IF EXISTS tenant_vehicles_tenant_id_platform_vehicle_id_key;

-- Optional: prevent duplicate rego within a tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_vehicles_unique_plate
  ON public.tenant_vehicles(tenant_id, plate)
  WHERE plate IS NOT NULL AND plate <> '';
