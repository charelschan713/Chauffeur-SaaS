DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_pricing_profile_item_type'
  ) THEN
    ALTER TABLE public.service_class_pricing_items
    ADD CONSTRAINT uq_pricing_profile_item_type
    UNIQUE (pricing_profile_id, item_type);
  END IF;
END $$;
