-- Seed a default auto-apply discount for aschauffeured (10% off all bookings)
-- Admin can edit/delete this via the Discounts page
INSERT INTO public.tenant_discounts (
  tenant_id,
  name,
  code,
  type,
  value,
  applies_to,
  min_fare_minor,
  max_discount_minor,
  active,
  created_at,
  updated_at
)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Welcome Discount',
  NULL,              -- auto-apply (no promo code required)
  'PERCENTAGE',
  10,               -- 10%
  'ALL',
  0,                -- applies from $0
  5000,             -- max $50 off
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_discounts
  WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND code IS NULL
    AND active = true
);
