ALTER TABLE public.platform_vehicles
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE public.tenant_vehicles
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS year integer NULL,
  ADD COLUMN IF NOT EXISTS colour text NULL,
  ADD COLUMN IF NOT EXISTS plate text NULL,
  ADD COLUMN IF NOT EXISTS passenger_capacity integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS luggage_capacity integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS notes text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.tenant_service_class_vehicles
  ADD COLUMN IF NOT EXISTS platform_vehicle_id uuid REFERENCES public.platform_vehicles(id);

CREATE TABLE IF NOT EXISTS public.tenant_service_class_platform_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  service_class_id uuid NOT NULL REFERENCES public.tenant_service_classes(id),
  platform_vehicle_id uuid NOT NULL REFERENCES public.platform_vehicles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(service_class_id, platform_vehicle_id)
);

ALTER TABLE public.tenant_service_class_platform_vehicles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_class_platform_vehicles'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.tenant_service_class_platform_vehicles
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scpv_service_class ON public.tenant_service_class_platform_vehicles(service_class_id);
CREATE INDEX IF NOT EXISTS idx_scpv_platform_vehicle ON public.tenant_service_class_platform_vehicles(platform_vehicle_id);
