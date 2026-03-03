ALTER TABLE public.tenant_service_types
  ADD COLUMN IF NOT EXISTS one_way_type text NOT NULL DEFAULT 'PERCENTAGE'
    CHECK (one_way_type IN ('PERCENTAGE','FIXED_SURCHARGE')),
  ADD COLUMN IF NOT EXISTS one_way_value numeric(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS one_way_surcharge_minor integer NOT NULL DEFAULT 0
    CHECK (one_way_surcharge_minor >= 0),
  ADD COLUMN IF NOT EXISTS return_type text NOT NULL DEFAULT 'PERCENTAGE'
    CHECK (return_type IN ('PERCENTAGE','FIXED_SURCHARGE')),
  ADD COLUMN IF NOT EXISTS return_value numeric(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS return_surcharge_minor integer NOT NULL DEFAULT 0
    CHECK (return_surcharge_minor >= 0),
  ADD COLUMN IF NOT EXISTS minimum_hours integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS km_per_hour_included integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_flow jsonb NOT NULL DEFAULT '{}'::jsonb;
