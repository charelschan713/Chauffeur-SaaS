-- Add vehicle spec fields to tenant_service_classes (used by public car-types API)
ALTER TABLE public.tenant_service_classes
  ADD COLUMN IF NOT EXISTS max_passengers   integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS luggage_capacity integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vehicle_class    text    DEFAULT NULL;
