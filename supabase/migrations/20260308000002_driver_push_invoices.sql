-- Add push token columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token  TEXT,
  ADD COLUMN IF NOT EXISTS apns_token       TEXT,
  ADD COLUMN IF NOT EXISTS apns_platform    TEXT DEFAULT 'expo';

-- Driver invoices table
CREATE TABLE IF NOT EXISTS public.driver_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  invoice_number   TEXT NOT NULL UNIQUE,
  assignment_ids   UUID[] NOT NULL DEFAULT '{}',
  total_minor      BIGINT NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'AUD',
  status           TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | SUBMITTED | APPROVED | PAID
  submitted_at     TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_invoices_driver_id ON public.driver_invoices(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_invoices_tenant_id ON public.driver_invoices(tenant_id);

-- Customer push token
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
