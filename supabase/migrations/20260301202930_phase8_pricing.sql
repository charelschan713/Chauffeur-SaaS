-- vehicle_classes
CREATE TABLE public.vehicle_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  multiplier numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (multiplier >= 0),
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- pricing_rules
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  service_type text NOT NULL DEFAULT 'POINT_TO_POINT',
  active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0 CHECK (priority >= 0),
  valid_from timestamptz,
  valid_to timestamptz,
  base_fare_minor int NOT NULL DEFAULT 0 CHECK (base_fare_minor >= 0),
  per_km_minor int NOT NULL DEFAULT 0 CHECK (per_km_minor >= 0),
  per_minute_minor int NOT NULL DEFAULT 0 CHECK (per_minute_minor >= 0),
  surge_multiplier numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

-- pricing_zones (simplified - no PostGIS)
CREATE TABLE public.pricing_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  pickup_zone_name text NOT NULL,
  dropoff_zone_name text NOT NULL,
  flat_price_minor int NOT NULL CHECK (flat_price_minor >= 0),
  vehicle_class_id uuid REFERENCES public.vehicle_classes(id),
  active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

-- Add pricing_snapshot to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;

-- Indexes
CREATE INDEX ON public.vehicle_classes(tenant_id, active, display_order);
CREATE INDEX ON public.vehicle_classes(tenant_id, code);
CREATE INDEX ON public.pricing_rules(tenant_id, active, priority DESC);
CREATE INDEX ON public.pricing_rules(tenant_id, service_type, active);
CREATE INDEX ON public.pricing_zones(tenant_id, active);

-- RLS
ALTER TABLE public.vehicle_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.vehicle_classes
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_isolation" ON public.pricing_rules
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_isolation" ON public.pricing_zones
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY "platform_admin_bypass" ON public.vehicle_classes
  USING (current_setting('app.is_platform_admin', true) = 'true');
CREATE POLICY "platform_admin_bypass" ON public.pricing_rules
  USING (current_setting('app.is_platform_admin', true) = 'true');
CREATE POLICY "platform_admin_bypass" ON public.pricing_zones
  USING (current_setting('app.is_platform_admin', true) = 'true');
