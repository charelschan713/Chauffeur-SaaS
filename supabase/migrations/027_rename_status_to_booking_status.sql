-- 027_rename_status_to_booking_status.sql
-- Align DB column name with backend code convention
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN status TO booking_status;
  END IF;
END $$;
