-- Delete unnamed/empty car types for aschauffeured tenant
DELETE FROM public.tenant_service_classes
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND (name IS NULL OR name = '');
