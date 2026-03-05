-- Add image_url to tenant_service_classes for the public booking widget
ALTER TABLE public.tenant_service_classes
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.tenant_service_classes.image_url IS
  'Public URL for car type image shown in the booking widget';
