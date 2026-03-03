ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_hash text;

-- backfill existing users with default password hash (12345678)
UPDATE public.users
SET password_hash = '$2b$10$URLvmLsuDPz1H4oD0ViLhecFi8tj7ftt/ESh/djVeIKCfbHtjXElu'
WHERE password_hash IS NULL;
