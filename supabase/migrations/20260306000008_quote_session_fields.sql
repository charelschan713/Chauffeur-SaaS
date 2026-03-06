-- Add converted_at to quote_sessions for tracking widget → booking conversion
ALTER TABLE public.quote_sessions
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Add luggage_count to bookings if missing
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS luggage_count INTEGER DEFAULT 0;
