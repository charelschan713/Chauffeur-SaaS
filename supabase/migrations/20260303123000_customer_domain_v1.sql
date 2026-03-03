-- Customer Domain V1

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone_country_code text,
  phone_number text,
  tier text NOT NULL DEFAULT 'STANDARD' CHECK (tier IN ('STANDARD','SILVER','GOLD','PLATINUM','VIP','CUSTOM')),
  custom_discount_type text NULL CHECK (custom_discount_type IN ('CUSTOM_PERCENT','CUSTOM_FIXED')),
  custom_discount_value numeric(10,2) NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_customer_user UNIQUE (tenant_id, user_id),
  CONSTRAINT chk_custom_discount CHECK (
    (tier = 'CUSTOM' AND custom_discount_type IS NOT NULL AND custom_discount_value IS NOT NULL) OR
    (tier != 'CUSTOM' AND custom_discount_type IS NULL AND custom_discount_value IS NULL)
  )
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.customers
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'platform_admin_bypass'
  ) THEN
    CREATE POLICY "platform_admin_bypass" ON public.customers
      USING (current_setting('app.is_platform_admin', true) = 'true');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS customers_tenant_idx ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS customers_tenant_email_idx ON public.customers(tenant_id, email);

CREATE TABLE IF NOT EXISTS public.customer_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone_country_code text,
  phone_number text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_passengers ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_passengers'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.customer_passengers
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_passengers'
      AND policyname = 'platform_admin_bypass'
  ) THEN
    CREATE POLICY "platform_admin_bypass" ON public.customer_passengers
      USING (current_setting('app.is_platform_admin', true) = 'true');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS customer_passengers_tenant_customer_idx ON public.customer_passengers(tenant_id, customer_id);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS passenger_id uuid REFERENCES public.customer_passengers(id);
