-- Add service reference columns to bookings (idempotent)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_class_id uuid REFERENCES public.tenant_service_classes(id),
  ADD COLUMN IF NOT EXISTS service_type_id  uuid REFERENCES public.tenant_service_types(id);
