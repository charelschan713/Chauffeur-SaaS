-- 034_test_data_backfill_for_new_driver_fields.sql

UPDATE drivers SET 
  first_name = 'John', last_name = 'Smith',
  email = 'john.smith@test.com', phone = '+61400000001'
WHERE license_number = 'DL001';

UPDATE drivers SET 
  first_name = 'Michael', last_name = 'Chen',
  email = 'michael.chen@test.com', phone = '+61400000002'
WHERE license_number = 'DL002';

UPDATE drivers SET 
  first_name = 'David', last_name = 'Wong',
  email = 'david.wong@test.com', phone = '+61400000003'
WHERE license_number = 'DL003';

UPDATE bookings 
SET booking_status = 'TRANSFER_PENDING'
WHERE booking_number = 'BK202602250005';
