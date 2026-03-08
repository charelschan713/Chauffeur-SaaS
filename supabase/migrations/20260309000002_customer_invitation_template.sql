-- Seed CustomerInvitation notification template for all tenants
INSERT INTO public.notification_templates (tenant_id, event_type, channel, subject, body, active)
SELECT
  t.id,
  'CustomerInvitation',
  'EMAIL',
  'You''re invited to {{company_name}} — Complete your profile',
  '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#0d0f14;padding:32px 40px;text-align:center;">
<p style="color:#c8a96b;font-size:20px;font-weight:600;margin:0;letter-spacing:2px;">{{company_name}}</p>
<div style="width:80px;height:1px;background:#c8a96b;margin:12px auto;opacity:0.4;"></div>
<p style="color:#c8a96b;font-size:10px;letter-spacing:3px;margin:0;opacity:0.6;font-style:italic;">PREMIUM CHAUFFEUR SERVICES</p>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#111827;margin:0 0 16px;">Welcome, {{customer_first_name}}!</h2>
<p style="color:#4b5563;line-height:1.7;margin:0 0 24px;">
  You have been added as a valued customer of <strong>{{company_name}}</strong>. Complete your profile to access exclusive chauffeur services and manage your bookings.
</p>
<div style="text-align:center;margin:32px 0;">
  <a href="{{login_url}}" style="background:#c8a96b;color:#0d0f14;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px;">ACCESS YOUR ACCOUNT</a>
</div>
<p style="color:#9ca3af;font-size:13px;margin:0;">Or copy this link: <a href="{{login_url}}" style="color:#c8a96b;">{{login_url}}</a></p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;margin:0;">© {{company_name}} · Luxury Chauffeur Services</p>
</td></tr>
</table></td></tr></table>
</body></html>',
  true
FROM public.tenants t
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;

-- SMS version
INSERT INTO public.notification_templates (tenant_id, event_type, channel, subject, body, active)
SELECT
  t.id,
  'CustomerInvitation',
  'SMS',
  NULL,
  'Hi {{customer_first_name}}, you''ve been invited to {{company_name}}. Access your account at: {{login_url}}',
  true
FROM public.tenants t
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;
