-- Vehicle uniqueness policy: allow multiple vehicles per model/type;
-- enforce uniqueness by rego (plate) per tenant.

-- Remove legacy uniqueness that blocked multiple vehicles of same platform vehicle/model.
ALTER TABLE public.tenant_vehicles
  DROP CONSTRAINT IF EXISTS tenant_vehicles_tenant_id_platform_vehicle_id_key;

DROP INDEX IF EXISTS public.idx_tenant_vehicles_tenant_platform_unique;
DROP INDEX IF EXISTS public.tenant_vehicles_tenant_id_platform_vehicle_id_key;

-- Keep/ensure rego uniqueness per tenant (case-insensitive), ignoring deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_vehicles_unique_plate_ci
  ON public.tenant_vehicles (tenant_id, lower(plate))
  WHERE plate IS NOT NULL AND plate <> '' AND deleted_at IS NULL;