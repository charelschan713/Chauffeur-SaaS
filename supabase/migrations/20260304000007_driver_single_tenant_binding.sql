-- Driver Single-Tenant Binding Rule
-- A driver can only have ONE active membership at a time.
-- To bind to another tenant, existing binding must be released first.
-- Uses membership_status_enum: {active, invited, disabled}

-- 1. Unique partial index: one active driver membership per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_single_active_membership
  ON public.memberships (user_id)
  WHERE role = 'driver' AND status = 'active';

-- 2. Binding history table
CREATE TABLE IF NOT EXISTS public.driver_binding_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL,
  bound_at      timestamptz NOT NULL DEFAULT NOW(),
  unbound_at    timestamptz,
  unbound_by    text CHECK (unbound_by IN ('driver','tenant','system')),
  unbound_reason text
);

CREATE INDEX IF NOT EXISTS idx_driver_binding_user ON public.driver_binding_history(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_binding_tenant ON public.driver_binding_history(tenant_id);

-- 3. Backfill current active memberships into history
INSERT INTO public.driver_binding_history (user_id, tenant_id, bound_at)
SELECT user_id, tenant_id, created_at
FROM public.memberships
WHERE role = 'driver' AND status = 'active'
ON CONFLICT DO NOTHING;
