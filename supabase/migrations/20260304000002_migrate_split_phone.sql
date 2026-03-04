-- Migrate to unified split phone format
-- No backward compatibility needed (no production users)

-- 1. Drop legacy single-field columns from bookings
ALTER TABLE public.bookings DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS passenger_phone;

-- 2. Ensure split columns exist in bookings (already added in phase2_3 + add_passenger_fields)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_phone_country_code text,
  ADD COLUMN IF NOT EXISTS customer_phone_number      text,
  ADD COLUMN IF NOT EXISTS passenger_phone_country_code text,
  ADD COLUMN IF NOT EXISTS passenger_phone_number     text;

-- 3. Drop legacy phone from users, add split columns
ALTER TABLE public.users DROP COLUMN IF EXISTS phone;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_number       text;
