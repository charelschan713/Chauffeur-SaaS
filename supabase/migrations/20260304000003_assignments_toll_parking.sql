-- Add toll_parking_minor to assignments table
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS toll_parking_minor integer NOT NULL DEFAULT 0;
