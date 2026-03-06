-- Add discount_rate to customers table
-- This is the customer's personal discount % (0–100)
-- Combined with base tenant discount, capped by tenant_discounts.max_discount_minor

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS discount_rate numeric(5,2) NOT NULL DEFAULT 0
    CHECK (discount_rate >= 0 AND discount_rate <= 100);

COMMENT ON COLUMN public.customers.discount_rate IS
  'Customer-level discount % (e.g. 5.00 = 5%). Stacked with any active base discount, capped at the discount max.';
