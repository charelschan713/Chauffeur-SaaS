ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS phone text;
