-- Delete all test bookings for aschauffeured tenant
DELETE FROM public.bookings
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND (
    (customer_first_name = 'Charles' AND customer_last_name = 'Test')
    OR (customer_first_name = 'Notify' AND customer_last_name = 'Test')
    OR (customer_first_name = 'Test'   AND customer_last_name = 'User')
  );
