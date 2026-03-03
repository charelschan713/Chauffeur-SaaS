ALTER TABLE public.tenant_service_types
  ADD COLUMN IF NOT EXISTS calculation_type text DEFAULT 'POINT_TO_POINT',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.tenant_service_classes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
