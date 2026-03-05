-- Extend tenant_branding with full theme fields for Step B tenant theming
ALTER TABLE public.tenant_branding
  ADD COLUMN IF NOT EXISTS primary_foreground text,
  ADD COLUMN IF NOT EXISTS font_family       text,
  ADD COLUMN IF NOT EXISTS cancel_window_hours integer DEFAULT 24;

COMMENT ON COLUMN public.tenant_branding.primary_foreground IS 'HSL string for text on primary bg, e.g. "240 8% 3%"';
COMMENT ON COLUMN public.tenant_branding.font_family        IS 'Google Font name for display headings, e.g. "Playfair Display"';
COMMENT ON COLUMN public.tenant_branding.cancel_window_hours IS 'Hours before pickup within which cancellation is restricted';
