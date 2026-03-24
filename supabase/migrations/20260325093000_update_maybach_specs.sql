-- Update passenger + luggage specs for Maybach models (ASChauffeured)
UPDATE public.tenant_service_classes SET
  max_passengers = 3,
  luggage_capacity = 3
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND name = 'Mercedes-Benz MAYBACH GLS600';

UPDATE public.tenant_service_classes SET
  max_passengers = 3,
  luggage_capacity = 2
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND name = 'Mercedes-Benz MAYBACH S680';
