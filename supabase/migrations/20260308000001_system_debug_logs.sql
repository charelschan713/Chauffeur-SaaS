-- ============================================================
-- System Debug Logs — Observability & Bug Tracing Layer
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_debug_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz DEFAULT now(),
  level        text NOT NULL CHECK (level IN ('info','warn','error')),
  source       text NOT NULL DEFAULT 'backend',
  request_id   text,
  tenant_id    uuid,
  user_id      uuid,
  booking_id   uuid,
  assignment_id uuid,
  transfer_id  uuid,
  invoice_id   uuid,
  event_name   text,
  message      text NOT NULL,
  metadata     jsonb
);

CREATE INDEX IF NOT EXISTS idx_sdl_request_id  ON public.system_debug_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_sdl_tenant_id   ON public.system_debug_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sdl_booking_id  ON public.system_debug_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_sdl_event_name  ON public.system_debug_logs(event_name);
CREATE INDEX IF NOT EXISTS idx_sdl_created_at  ON public.system_debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdl_level       ON public.system_debug_logs(level) WHERE level = 'error';
