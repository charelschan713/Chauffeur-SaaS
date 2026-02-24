-- 038_drivers_user_id_nullable.sql
-- Allow admin-created drivers without auth user linkage.
ALTER TABLE drivers
  ALTER COLUMN user_id DROP NOT NULL;
