CREATE TABLE public.tenant_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_type text NOT NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, event_type, channel)
);

ALTER TABLE public.tenant_notification_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_notification_templates'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.tenant_notification_templates
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_notification_templates'
      AND policyname = 'platform_admin_bypass'
  ) THEN
    CREATE POLICY "platform_admin_bypass" ON public.tenant_notification_templates
      USING (current_setting('app.is_platform_admin', true) = 'true');
  END IF;
END $$;

CREATE INDEX ON public.tenant_notification_templates(tenant_id, event_type, channel);
