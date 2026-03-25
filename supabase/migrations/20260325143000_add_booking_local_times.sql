ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_at_local timestamp,
  ADD COLUMN IF NOT EXISTS return_pickup_at_local timestamp;
