-- Ensure aschauffeured admin user has correct membership
INSERT INTO public.memberships (tenant_id, user_id, role, status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'f59adbec-39b2-4fe3-a66e-bf69350c8732',
  'tenant_admin',
  'active'
)
ON CONFLICT (tenant_id, user_id)
DO UPDATE SET role = 'tenant_admin', status = 'active', updated_at = now();
