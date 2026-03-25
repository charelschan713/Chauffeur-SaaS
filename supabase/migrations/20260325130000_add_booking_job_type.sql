ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS job_type text DEFAULT 'NORMAL';

UPDATE public.bookings
  SET job_type = 'NORMAL'
  WHERE job_type IS NULL;
