-- ─────────────────────────────────────────────────────────────────────────────
-- External Driver/Vehicle Verification + Badges + Transfer Booking Indicator
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ENUMs
DO $$ BEGIN
  CREATE TYPE public.asset_source_type AS ENUM ('INTERNAL', 'EXTERNAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. BOOKING_SOURCE: ensure TRANSFER_IN exists (already present per schema check)
-- No change needed — booking_source_enum already has TRANSFER_IN.

-- 3. Driver columns (on users/memberships — we track at memberships level via separate table)
-- Since drivers are users+memberships, we add a driver_profiles table for extra fields.
CREATE TABLE IF NOT EXISTS public.driver_profiles (
  user_id               uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  source_type           public.asset_source_type NOT NULL DEFAULT 'INTERNAL',
  approval_status       public.approval_status   NOT NULL DEFAULT 'APPROVED',
  platform_verified     boolean                  NOT NULL DEFAULT false,
  -- For EXTERNAL drivers: the originating user_id on the platform (or null if off-platform)
  external_driver_id    uuid NULL REFERENCES public.users(id),
  apply_reason          text,
  platform_notes        text,
  reviewed_at           timestamptz,
  reviewed_by           uuid REFERENCES public.users(id),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_source_approval ON public.driver_profiles(source_type, approval_status);
CREATE INDEX IF NOT EXISTS idx_dp_external        ON public.driver_profiles(external_driver_id);

-- Backfill: create INTERNAL APPROVED profile for every existing driver membership
INSERT INTO public.driver_profiles (user_id, source_type, approval_status, platform_verified)
SELECT DISTINCT user_id, 'INTERNAL'::public.asset_source_type, 'APPROVED'::public.approval_status, false
FROM public.memberships
WHERE role = 'driver'
ON CONFLICT (user_id) DO NOTHING;

-- 4. Vehicle columns
ALTER TABLE public.tenant_vehicles
  ADD COLUMN IF NOT EXISTS source_type        public.asset_source_type NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS approval_status    public.approval_status   NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS platform_verified  boolean                  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_driver_id uuid NULL REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_tv_source_approval ON public.tenant_vehicles(source_type, approval_status);
CREATE INDEX IF NOT EXISTS idx_tv_external        ON public.tenant_vehicles(external_driver_id);
CREATE INDEX IF NOT EXISTS idx_tv_tenant_active   ON public.tenant_vehicles(tenant_id, active);

-- 5. External Driver Connection table
CREATE TABLE IF NOT EXISTS public.tenant_external_driver_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_driver_id  uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'CONNECTED'
                        CHECK (status IN ('PENDING','CONNECTED','REJECTED','DISCONNECTED')),
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, external_driver_id)
);
CREATE INDEX IF NOT EXISTS idx_tedc_tenant  ON public.tenant_external_driver_connections(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tedc_driver  ON public.tenant_external_driver_connections(external_driver_id, status);

-- 6. Booking transfer snapshot columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS owner_tenant_id                    uuid NULL REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS executor_tenant_id                 uuid NULL REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS transfer_source_tenant_name_snapshot text NULL;

-- Backfill existing bookings: owner = executor = tenant_id
UPDATE public.bookings
SET owner_tenant_id    = tenant_id,
    executor_tenant_id = tenant_id
WHERE owner_tenant_id IS NULL;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- 7. tenant_external_driver_connections RLS
ALTER TABLE public.tenant_external_driver_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tedc_tenant_isolation ON public.tenant_external_driver_connections;
CREATE POLICY tedc_tenant_isolation ON public.tenant_external_driver_connections
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 8. driver_profiles RLS
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dp_read_policy ON public.driver_profiles;
CREATE POLICY dp_read_policy ON public.driver_profiles
  FOR SELECT
  USING (
    -- Own profile
    user_id::text = current_setting('app.user_id', true)
    -- Internal driver for tenant (via membership)
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = driver_profiles.user_id
        AND m.tenant_id::text = current_setting('app.tenant_id', true)
        AND m.role = 'driver'
    )
    -- External driver with active connection
    OR (
      source_type = 'EXTERNAL'
      AND approval_status = 'APPROVED'
      AND platform_verified = true
      AND EXISTS (
        SELECT 1 FROM public.tenant_external_driver_connections c
        WHERE c.external_driver_id = driver_profiles.user_id
          AND c.tenant_id::text = current_setting('app.tenant_id', true)
          AND c.status = 'CONNECTED'
      )
    )
    -- Platform admin bypass
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 9. tenant_vehicles: external visibility policy (extend existing or create)
-- Drop and recreate to ensure external gate is included
ALTER TABLE public.tenant_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tv_tenant_isolation ON public.tenant_vehicles;
CREATE POLICY tv_tenant_isolation ON public.tenant_vehicles
  FOR SELECT
  USING (
    -- Internal: own tenant's vehicle
    (source_type = 'INTERNAL' AND tenant_id::text = current_setting('app.tenant_id', true))
    -- External: approved + verified + connected driver
    OR (
      source_type = 'EXTERNAL'
      AND approval_status = 'APPROVED'
      AND platform_verified = true
      AND external_driver_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.tenant_external_driver_connections c
        WHERE c.external_driver_id = tenant_vehicles.external_driver_id
          AND c.tenant_id::text = current_setting('app.tenant_id', true)
          AND c.status = 'CONNECTED'
      )
    )
    -- Platform admin bypass
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tv_tenant_write ON public.tenant_vehicles;
CREATE POLICY tv_tenant_write ON public.tenant_vehicles
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );
