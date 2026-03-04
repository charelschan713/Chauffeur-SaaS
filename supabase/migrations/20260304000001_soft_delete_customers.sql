-- TASK 1: Add soft delete to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
  ON public.customers(deleted_at)
  WHERE deleted_at IS NULL;
