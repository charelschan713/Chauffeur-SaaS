-- Drop legacy tables
DROP TABLE IF EXISTS public.pricing_zones CASCADE;
DROP TABLE IF EXISTS public.pricing_rules CASCADE;
DROP TABLE IF EXISTS public.vehicle_classes CASCADE;

-- Reset snapshot column
ALTER TABLE public.bookings DROP COLUMN IF EXISTS pricing_snapshot;

-- Enums
CREATE TYPE public.pricing_item_type AS ENUM (
  'BASE_FARE','PER_KM','DRIVING_TIME',
  'WAITING_TIME','HOURLY_RATE','WAYPOINT','BABYSEAT'
);
CREATE TYPE public.pricing_unit AS ENUM (
  'flat','per_km','per_minute','per_hour','per_item'
);

-- platform_vehicles
CREATE TABLE public.platform_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  year int NOT NULL,
  plate text NULL,
  color text,
  passenger_capacity int NOT NULL DEFAULT 4,
  luggage_capacity int NOT NULL DEFAULT 2,
  vehicle_type_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.platform_vehicles(make, model, year);
CREATE INDEX ON public.platform_vehicles(vehicle_type_name);
ALTER TABLE public.platform_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_vehicles_read" ON public.platform_vehicles
  FOR SELECT USING (true);
CREATE POLICY "platform_vehicles_admin_write" ON public.platform_vehicles
  FOR ALL USING (current_setting('app.is_platform_admin', true) = 'true');

-- tenant_vehicles
CREATE TABLE public.tenant_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  platform_vehicle_id uuid NOT NULL REFERENCES public.platform_vehicles(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform_vehicle_id)
);
CREATE INDEX ON public.tenant_vehicles(tenant_id);
CREATE INDEX ON public.tenant_vehicles(platform_vehicle_id);
ALTER TABLE public.tenant_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.tenant_vehicles
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "platform_admin_bypass" ON public.tenant_vehicles
  USING (current_setting('app.is_platform_admin', true) = 'true');

-- tenant_service_classes
CREATE TABLE public.tenant_service_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  surge_multiplier numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (surge_multiplier >= 0),
  currency text NOT NULL DEFAULT 'AUD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tenant_service_classes(tenant_id, active, display_order);
ALTER TABLE public.tenant_service_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.tenant_service_classes
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "platform_admin_bypass" ON public.tenant_service_classes
  USING (current_setting('app.is_platform_admin', true) = 'true');

-- tenant_service_class_vehicles
CREATE TABLE public.tenant_service_class_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  service_class_id uuid NOT NULL REFERENCES public.tenant_service_classes(id),
  tenant_vehicle_id uuid NOT NULL REFERENCES public.tenant_vehicles(id),
  UNIQUE (service_class_id, tenant_vehicle_id)
);
CREATE INDEX ON public.tenant_service_class_vehicles(tenant_id);
CREATE INDEX ON public.tenant_service_class_vehicles(service_class_id);
ALTER TABLE public.tenant_service_class_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.tenant_service_class_vehicles
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "platform_admin_bypass" ON public.tenant_service_class_vehicles
  USING (current_setting('app.is_platform_admin', true) = 'true');

-- service_class_pricing_items
CREATE TABLE public.service_class_pricing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  service_class_id uuid NOT NULL REFERENCES public.tenant_service_classes(id),
  item_type public.pricing_item_type NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  unit public.pricing_unit NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.service_class_pricing_items(tenant_id);
CREATE INDEX ON public.service_class_pricing_items(service_class_id, active);
CREATE INDEX ON public.service_class_pricing_items(item_type);
ALTER TABLE public.service_class_pricing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.service_class_pricing_items
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "platform_admin_bypass" ON public.service_class_pricing_items
  USING (current_setting('app.is_platform_admin', true) = 'true');

-- pricing_zones
CREATE TABLE public.pricing_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  service_class_id uuid NOT NULL REFERENCES public.tenant_service_classes(id),
  name text NOT NULL,
  pickup_zone_name text NOT NULL,
  dropoff_zone_name text NOT NULL,
  flat_price_minor bigint NOT NULL CHECK (flat_price_minor >= 0),
  valid_from timestamptz,
  valid_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);
CREATE INDEX ON public.pricing_zones(tenant_id, service_class_id, active);
CREATE INDEX ON public.pricing_zones(tenant_id, pickup_zone_name, dropoff_zone_name);
ALTER TABLE public.pricing_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.pricing_zones
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY "platform_admin_bypass" ON public.pricing_zones
  USING (current_setting('app.is_platform_admin', true) = 'true');

-- Booking snapshot columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS service_class_id uuid
    REFERENCES public.tenant_service_classes(id);
