INSERT INTO public.users (id, email, full_name, is_platform_admin)
VALUES 
  ('f59adbec-39b2-4fe3-a66e-bf69350c8732', 
   'admin@aschauffeured.com.au', 
   'AS Chauffeured Admin', 
   false),
  ('bd29fce2-71be-4889-847f-76a6a96768b7', 
   'admin@mrdrivers.com.au', 
   'MrDrivers Admin', 
   false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.memberships 
  (tenant_id, user_id, role, status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'f59adbec-39b2-4fe3-a66e-bf69350c8732',
   'tenant_admin',
   'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'bd29fce2-71be-4889-847f-76a6a96768b7',
   'tenant_admin',
   'active')
ON CONFLICT DO NOTHING;
