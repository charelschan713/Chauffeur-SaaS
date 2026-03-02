-- Phase 8 V3 Pricing

-- 1. New: tenant_service_types
CREATE TABLE IF NOT EXISTS public.tenant_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  code text NOT NULL,
  display_name text NOT NULL,
  booking_flow jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, code)
);
ALTER TABLE public.tenant_service_types ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_types'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.tenant_service_types
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_types'
      AND policyname = 'platform_admin_bypass'
  ) THEN
    CREATE POLICY "platform_admin_bypass" ON public.tenant_service_types
      USING (current_setting('app.is_platform_admin', true) = 'true');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS tenant_service_types_tenant_id_idx ON public.tenant_service_types(tenant_id);

-- 2. New: tenant_service_pricing_profiles
CREATE TABLE IF NOT EXISTS public.tenant_service_pricing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  service_type_id uuid NOT NULL REFERENCES public.tenant_service_types(id),
  service_class_id uuid NOT NULL REFERENCES public.tenant_service_classes(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, service_type_id, service_class_id)
);
ALTER TABLE public.tenant_service_pricing_profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_pricing_profiles'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.tenant_service_pricing_profiles
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_service_pricing_profiles'
      AND policyname = 'platform_admin_bypass'
  ) THEN
    CREATE POLICY "platform_admin_bypass" ON public.tenant_service_pricing_profiles
      USING (current_setting('app.is_platform_admin', true) = 'true');
  END IF;
END $$;

-- 3. New: hourly_pricing_configs
CREATE TABLE IF NOT EXISTS public.hourly_pricing_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_profile_id uuid UNIQUE NOT NULL REFERENCES public.tenant_service_pricing_profiles(id),
  minimum_hours integer NOT NULL DEFAULT 2,
  km_per_hour_included integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Add pricing_profile_id to pricing items (nullable first)
ALTER TABLE public.service_class_pricing_items
  ADD COLUMN IF NOT EXISTS pricing_profile_id uuid REFERENCES public.tenant_service_pricing_profiles(id);

-- 5. Add image_url to service classes
ALTER TABLE public.tenant_service_classes
  ADD COLUMN IF NOT EXISTS image_url text;
