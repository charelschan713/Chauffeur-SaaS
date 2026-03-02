-- Phase 8 Pricing Upgrade
-- Add new pricing item types
ALTER TYPE public.pricing_item_type ADD VALUE IF NOT EXISTS 'MINIMUM_FARE';
ALTER TYPE public.pricing_item_type ADD VALUE IF NOT EXISTS 'WAITING_TIME';
ALTER TYPE public.pricing_item_type ADD VALUE IF NOT EXISTS 'INFANT_SEAT';
ALTER TYPE public.pricing_item_type ADD VALUE IF NOT EXISTS 'TODDLER_SEAT';
ALTER TYPE public.pricing_item_type ADD VALUE IF NOT EXISTS 'BOOSTER_SEAT';

-- Soft delete BABYSEAT items (retain history)
UPDATE public.service_class_pricing_items
SET active = false
WHERE item_type = 'BABYSEAT';

-- Ensure unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_service_class_item_type'
  ) THEN
    ALTER TABLE public.service_class_pricing_items
      ADD CONSTRAINT uq_service_class_item_type UNIQUE (service_class_id, item_type);
  END IF;
END $$;
