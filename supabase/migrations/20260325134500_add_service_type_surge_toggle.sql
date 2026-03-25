ALTER TABLE public.tenant_service_types
  ADD COLUMN IF NOT EXISTS surge_enabled boolean DEFAULT true;

UPDATE public.tenant_service_types
  SET surge_enabled = true
  WHERE surge_enabled IS NULL;
