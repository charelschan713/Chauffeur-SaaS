-- ─────────────────────────────────────────────────────────────────────────────
-- Booking Transfers + Partner Assignment
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. booking_transfers table
CREATE TABLE IF NOT EXISTS public.booking_transfers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  requester_tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
  partner_tenant_id         uuid NOT NULL REFERENCES public.tenants(id),
  status                    text NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED')),
  partner_pay_type          text NOT NULL DEFAULT 'PERCENTAGE'
                              CHECK (partner_pay_type IN ('PERCENTAGE','FIXED')),
  partner_pay_value         numeric(10,4) NOT NULL DEFAULT 0,
  partner_pay_minor         integer NOT NULL DEFAULT 0,
  toll_parking_minor        integer NOT NULL DEFAULT 0,
  partner_platform_fee_minor integer NOT NULL DEFAULT 0,
  reject_reason             text,
  created_by                uuid REFERENCES public.users(id),
  accepted_at               timestamptz,
  rejected_at               timestamptz,
  cancelled_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT NOW(),
  updated_at                timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bt_booking      ON public.booking_transfers(booking_id);
CREATE INDEX IF NOT EXISTS idx_bt_requester    ON public.booking_transfers(requester_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bt_partner      ON public.booking_transfers(partner_tenant_id, status);

-- 2. assignments table: add partner fields
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type        text NOT NULL DEFAULT 'DRIVER'
                              CHECK (assignment_type IN ('DRIVER','PARTNER')),
  ADD COLUMN IF NOT EXISTS partner_tenant_id      uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS transfer_id            uuid REFERENCES public.booking_transfers(id),
  ADD COLUMN IF NOT EXISTS partner_pay_type       text CHECK (partner_pay_type IN ('PERCENTAGE','FIXED')),
  ADD COLUMN IF NOT EXISTS partner_pay_value      numeric(10,4),
  ADD COLUMN IF NOT EXISTS partner_pay_minor      integer,
  ADD COLUMN IF NOT EXISTS partner_platform_fee_minor integer;

CREATE INDEX IF NOT EXISTS idx_asgn_partner ON public.assignments(partner_tenant_id)
  WHERE partner_tenant_id IS NOT NULL;

-- 3. RLS: booking_transfers
ALTER TABLE public.booking_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bt_isolation ON public.booking_transfers;
CREATE POLICY bt_isolation ON public.booking_transfers
  FOR ALL
  USING (
    requester_tenant_id::text = current_setting('app.tenant_id', true)
    OR partner_tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );
