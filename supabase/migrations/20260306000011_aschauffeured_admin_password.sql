-- Set password for aschauffeured admin user
-- Password: Admin1234!
UPDATE public.users
SET password_hash = '$2b$12$ZyjfIrNY6WCKZnDvi9Pm4uFJc3I/dnHC6Mw1MoeNMsqMOgh8hNh4y',
    updated_at    = now()
WHERE id = 'f59adbec-39b2-4fe3-a66e-bf69350c8732'
  AND email = 'admin@aschauffeured.com.au';
