ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_return_trip boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_pickup_at_utc timestamptz NULL,
  ADD COLUMN IF NOT EXISTS return_pickup_address_text text NULL,
  ADD COLUMN IF NOT EXISTS return_pickup_lat numeric NULL,
  ADD COLUMN IF NOT EXISTS return_pickup_lng numeric NULL,
  ADD COLUMN IF NOT EXISTS return_pickup_place_id text NULL;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS leg text DEFAULT 'A'
    CHECK (leg IN ('A', 'B'));
