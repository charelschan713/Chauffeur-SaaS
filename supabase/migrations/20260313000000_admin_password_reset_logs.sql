-- Admin password reset audit log
CREATE TABLE IF NOT EXISTS public.admin_password_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_user_type text NOT NULL,
  action_type text NOT NULL,
  reset_mode text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_password_reset_logs_tenant_id_idx
  ON public.admin_password_reset_logs (tenant_id, created_at DESC);
