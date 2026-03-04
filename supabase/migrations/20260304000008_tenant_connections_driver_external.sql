-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant-to-Tenant Connections + Driver External Order Approval
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tenant Connections
CREATE TABLE IF NOT EXISTS public.tenant_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  acceptor_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- internal: both on platform | external: acceptor not on platform (or vice versa)
  connection_type     text NOT NULL DEFAULT 'internal'
                        CHECK (connection_type IN ('internal','external')),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','rejected','suspended','cancelled')),
  -- For external: platform must approve before activation
  platform_approved   boolean NOT NULL DEFAULT false,
  platform_reviewed_at timestamptz,
  platform_reviewed_by uuid REFERENCES public.users(id),
  platform_notes      text,
  -- Metadata
  requester_note      text,
  acceptor_note       text,
  requested_at        timestamptz NOT NULL DEFAULT NOW(),
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  -- Prevent duplicate active connections
  CONSTRAINT tenant_connections_unique UNIQUE (requester_id, acceptor_id)
);

CREATE INDEX IF NOT EXISTS idx_tc_requester ON public.tenant_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_tc_acceptor  ON public.tenant_connections(acceptor_id);
CREATE INDEX IF NOT EXISTS idx_tc_status    ON public.tenant_connections(status);

-- 2. Driver External Order Approval
--    A driver must be platform-approved before receiving orders from external tenants
CREATE TABLE IF NOT EXISTS public.driver_external_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','suspended')),
  apply_reason    text,
  platform_notes  text,
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)  -- one application per driver
);

CREATE INDEX IF NOT EXISTS idx_dea_status ON public.driver_external_approvals(status);
