CREATE TABLE public.tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  integration_type text NOT NULL,
  config_encrypted jsonb NOT NULL DEFAULT '{}',
  masked_preview text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_type)
);

CREATE INDEX ON public.tenant_integrations(tenant_id);
CREATE INDEX ON public.tenant_integrations(tenant_id, integration_type);
CREATE INDEX ON public.tenant_integrations(tenant_id, active);

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.tenant_integrations
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY "platform_admin_bypass" ON public.tenant_integrations
  USING (current_setting('app.is_platform_admin', true) = 'true');
