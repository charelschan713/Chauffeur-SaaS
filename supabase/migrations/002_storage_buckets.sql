-- Step 7: Supabase Storage Buckets
-- Creates required buckets if they do not already exist

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('driver-docs', 'driver-docs', false),
  ('vehicle-photos', 'vehicle-photos', true),
  ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO NOTHING;
