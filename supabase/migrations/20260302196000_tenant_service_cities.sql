CREATE TABLE public.tenant_service_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  timezone text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.tenant_service_cities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_cities'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.tenant_service_cities
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_cities'
      AND policyname = 'platform_admin_bypass'
  ) THEN
    CREATE POLICY "platform_admin_bypass" ON public.tenant_service_cities
      USING (current_setting('app.is_platform_admin', true) = 'true');
  END IF;
END $$;

CREATE INDEX ON public.tenant_service_cities(tenant_id);
