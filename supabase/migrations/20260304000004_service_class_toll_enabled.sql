-- Add toll_enabled flag to service classes
-- When true, toll/parking cost is auto-calculated from route and added to booking fare
ALTER TABLE public.tenant_service_classes
  ADD COLUMN IF NOT EXISTS toll_enabled boolean NOT NULL DEFAULT false;
