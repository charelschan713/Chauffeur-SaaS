INSERT INTO public.tenants (id, name, slug, status, timezone, currency) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ASChauffeured','aschauffeured','active','Australia/Sydney','AUD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, name, slug, status, timezone, currency) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','MrDrivers','mrdrivers','active','Australia/Sydney','AUD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, settings) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{}')
ON CONFLICT (tenant_id) DO NOTHING;
