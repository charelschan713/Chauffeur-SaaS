DELETE FROM public.bookings
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND payment_status = 'UNPAID'
  AND booking_source = 'WIDGET';
