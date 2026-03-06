-- Seed max_passengers and vehicle_class for aschauffeured car types
UPDATE public.tenant_service_classes SET
  max_passengers = 4, vehicle_class = 'Luxury SUV'
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND name = 'Mercedes-Benz GLS';

UPDATE public.tenant_service_classes SET
  max_passengers = 3, vehicle_class = 'Luxury Sedan'
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND name = 'Mercedes-Benz S-Class L';

UPDATE public.tenant_service_classes SET
  max_passengers = 6, vehicle_class = 'Luxury MPV'
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND name = 'Mercedes-Benz V-Class';

UPDATE public.tenant_service_classes SET
  max_passengers = 11, vehicle_class = 'Minibus'
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND name = 'Mercedes-Benz Sprinter-12-Seaters';

UPDATE public.tenant_service_classes SET
  max_passengers = 8, vehicle_class = 'VIP Van'
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND name = 'Mercedes-Benz Sprinter-VIP';
