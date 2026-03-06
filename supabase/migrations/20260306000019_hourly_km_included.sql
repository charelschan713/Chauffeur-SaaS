-- Set km_per_hour_included = 20 for Hourly Charter service types for aschauffeured
UPDATE tenant_service_types
SET km_per_hour_included = 20
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND calculation_type = 'HOURLY_CHARTER';
