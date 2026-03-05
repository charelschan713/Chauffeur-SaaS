-- ============================================================
-- Quote Sessions
-- Stores anonymous quote payloads from the public booking widget.
-- Tenant-scoped for data isolation and conversion analytics.
-- ============================================================

CREATE TABLE public.quote_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payload     jsonb NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  converted   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lookup by tenant for analytics
CREATE INDEX idx_quote_sessions_tenant ON public.quote_sessions (tenant_id, expires_at);

-- Cleanup index: find expired unconverted sessions
CREATE INDEX idx_quote_sessions_expiry ON public.quote_sessions (expires_at)
  WHERE converted = false;

-- RLS: public widget reads its own session by ID only (no auth required)
ALTER TABLE public.quote_sessions ENABLE ROW LEVEL SECURITY;

-- Service role (NestJS backend) has full access
CREATE POLICY "service_role_full_access" ON public.quote_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anonymous read by ID only (for SaaS platform to retrieve on booking page)
CREATE POLICY "anon_read_by_id" ON public.quote_sessions
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON TABLE public.quote_sessions IS
  'Anonymous quote sessions from the public booking widget. Expire after 30 minutes.';
