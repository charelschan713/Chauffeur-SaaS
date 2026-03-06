-- Ensure minimum_hours and surge_multiplier exist on tenant_service_types
ALTER TABLE public.tenant_service_types
  ADD COLUMN IF NOT EXISTS minimum_hours    integer        NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS surge_multiplier numeric(5,2)  NOT NULL DEFAULT 1.0;
