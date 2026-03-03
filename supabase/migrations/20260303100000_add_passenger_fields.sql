ALTER TABLE public.bookings
  ADD COLUMN passenger_first_name text,
  ADD COLUMN passenger_last_name text,
  ADD COLUMN passenger_phone_country_code text,
  ADD COLUMN passenger_phone_number text,
  ADD COLUMN passenger_is_customer boolean NOT NULL DEFAULT true;

UPDATE public.bookings
SET passenger_first_name = customer_first_name,
    passenger_last_name = customer_last_name,
    passenger_phone_country_code = customer_phone_country_code,
    passenger_phone_number = customer_phone_number,
    passenger_is_customer = true
WHERE passenger_first_name IS NULL;
