ALTER TABLE public.tenant_branding
  ADD COLUMN IF NOT EXISTS website_url text;

-- Set aschauffeured website URL
UPDATE public.tenant_branding
SET website_url = 'https://aschauffeured.com.au/#book'
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
