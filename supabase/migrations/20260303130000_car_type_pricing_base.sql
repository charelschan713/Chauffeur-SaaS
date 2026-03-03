ALTER TABLE public.tenant_service_classes
  ADD COLUMN IF NOT EXISTS base_fare_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_km_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_min_driving_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_min_waiting_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_fare_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waypoint_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infant_seat_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toddler_seat_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booster_seat_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate_minor integer DEFAULT 0;
