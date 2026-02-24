-- 040_booking_status_fix.sql
-- Pack #55: booking status unify to DRIVER_ASSIGNED

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_status_check
  CHECK (
    booking_status IN (
      'PENDING',
      'CONFIRMED',
      'DRIVER_ASSIGNED',
      'IN_PROGRESS',
      'JOB_DONE',
      'FULFILLED',
      'TRANSFER_PENDING',
      'TRANSFERRED',
      'CANCELLED'
    )
  );

UPDATE bookings
SET booking_status = 'DRIVER_ASSIGNED'
WHERE booking_status = 'ASSIGNED';
