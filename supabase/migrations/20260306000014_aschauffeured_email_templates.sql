-- ASChauffeured branded HTML email templates
-- Dark luxury gold theme matching website style

DO $$
DECLARE
  tid uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  base_wrap text := '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>%s</title>
</head>
<body style="margin:0;padding:0;background:#0d0f14;font-family:Georgia,serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#0d0f14;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;">

  <!-- Header -->
  <tr>
    <td style="background:#111318;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;border-bottom:1px solid #2a2d35;">
      <p style="margin:0;font-size:22px;font-weight:bold;color:#c8a96b;letter-spacing:2px;text-transform:uppercase;">AS Chauffeured</p>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;letter-spacing:3px;text-transform:uppercase;">Luxury Chauffeur Service</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#111318;padding:40px;border-radius:0 0 16px 16px;">
      %s
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:28px 0 0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#4b5563;">ASChauffeured &bull; Sydney, Australia</p>
      <p style="margin:6px 0 0;font-size:11px;color:#374151;">
        <a href="https://www.aschauffeured.com.au" style="color:#c8a96b;text-decoration:none;">www.aschauffeured.com.au</a>
        &nbsp;&bull;&nbsp;
        <a href="tel:+61280000000" style="color:#c8a96b;text-decoration:none;">+61 2 8000 0000</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>';

  -- Reusable booking detail block
  booking_block text := '
    <table width="100%%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#0d0f14;border-radius:12px;border:1px solid #1f2937;">
      <tr><td style="padding:20px 24px;">
        <table width="100%%" cellpadding="0" cellspacing="10">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1f2937;">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Booking Reference</span><br/>
              <span style="font-size:15px;font-weight:bold;color:#c8a96b;font-family:monospace;">{{booking_reference}}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1f2937;">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Pickup</span><br/>
              <span style="font-size:14px;color:#e5e7eb;">{{pickup_address}}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1f2937;">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Drop-off</span><br/>
              <span style="font-size:14px;color:#e5e7eb;">{{dropoff_address}}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1f2937;">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</span><br/>
              <span style="font-size:14px;color:#e5e7eb;">{{pickup_time}}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Total</span><br/>
              <span style="font-size:16px;font-weight:bold;color:#c8a96b;">{{total_price}}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>';

BEGIN

-- ── Booking Confirmed ──────────────────────────────────────────────────────
INSERT INTO public.tenant_notification_templates (tenant_id, event_type, channel, subject, body)
VALUES (
  tid, 'BookingConfirmed', 'email',
  'Your booking is confirmed — {{booking_reference}}',
  format(base_wrap, 'Booking Confirmed',
    format('
      <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;font-weight:bold;">Your booking is confirmed</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">Dear {{customer_name}},</p>
      <p style="margin:0 0 4px;font-size:15px;color:#d1d5db;">
        We are delighted to confirm your reservation with ASChauffeured.
        Your professional chauffeur will be ready for you.
      </p>
      %s
      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
        For any enquiries, please contact us at
        <a href="mailto:info@aschauffeured.com.au" style="color:#c8a96b;">info@aschauffeured.com.au</a>
      </p>', booking_block)
  )
)
ON CONFLICT (tenant_id, event_type, channel)
DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();

-- ── Driver Assigned ────────────────────────────────────────────────────────
INSERT INTO public.tenant_notification_templates (tenant_id, event_type, channel, subject, body)
VALUES (
  tid, 'DriverAcceptedAssignment', 'email',
  'Your driver has been assigned — {{booking_reference}}',
  format(base_wrap, 'Driver Assigned',
    format('
      <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;font-weight:bold;">Your driver is confirmed</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">Dear {{customer_name}},</p>
      <p style="margin:0 0 4px;font-size:15px;color:#d1d5db;">
        Your professional chauffeur <strong style="color:#c8a96b;">{{driver_name}}</strong>
        has been assigned to your booking in a <strong style="color:#e5e7eb;">{{vehicle_make}} {{vehicle_model}}</strong>.
      </p>
      %s
      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
        Need assistance? Contact us at
        <a href="mailto:info@aschauffeured.com.au" style="color:#c8a96b;">info@aschauffeured.com.au</a>
      </p>', booking_block)
  )
)
ON CONFLICT (tenant_id, event_type, channel)
DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();

-- ── Driver En Route ────────────────────────────────────────────────────────
INSERT INTO public.tenant_notification_templates (tenant_id, event_type, channel, subject, body)
VALUES (
  tid, 'DriverInvitationSent', 'email',
  'Your chauffeur is on the way — {{booking_reference}}',
  format(base_wrap, 'Driver En Route',
    format('
      <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;font-weight:bold;">Your chauffeur is on the way</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">Dear {{customer_name}},</p>
      <p style="margin:0 0 4px;font-size:15px;color:#d1d5db;">
        <strong style="color:#c8a96b;">{{driver_name}}</strong> is heading to your pickup location.
        Please be ready at the scheduled time.
      </p>
      %s', booking_block)
  )
)
ON CONFLICT (tenant_id, event_type, channel)
DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();

-- ── Booking Completed ──────────────────────────────────────────────────────
INSERT INTO public.tenant_notification_templates (tenant_id, event_type, channel, subject, body)
VALUES (
  tid, 'JobCompleted', 'email',
  'Thank you for riding with ASChauffeured — {{booking_reference}}',
  format(base_wrap, 'Trip Completed',
    format('
      <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;font-weight:bold;">Thank you for choosing us</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">Dear {{customer_name}},</p>
      <p style="margin:0 0 4px;font-size:15px;color:#d1d5db;">
        Your journey has been completed. We hope you enjoyed the experience.
        We look forward to serving you again.
      </p>
      %s
      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
        We value your feedback. Please share your experience with us.
      </p>', booking_block)
  )
)
ON CONFLICT (tenant_id, event_type, channel)
DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();

-- ── Booking Cancelled ──────────────────────────────────────────────────────
INSERT INTO public.tenant_notification_templates (tenant_id, event_type, channel, subject, body)
VALUES (
  tid, 'BookingCancelled', 'email',
  'Your booking has been cancelled — {{booking_reference}}',
  format(base_wrap, 'Booking Cancelled',
    '
      <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;font-weight:bold;">Booking Cancelled</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">Dear {{customer_name}},</p>
      <p style="margin:0 0 4px;font-size:15px;color:#d1d5db;">
        Your booking <strong style="color:#c8a96b;font-family:monospace;">{{booking_reference}}</strong>
        has been cancelled. If you believe this is an error or would like to rebook,
        please contact us.
      </p>
      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
        Contact us at
        <a href="mailto:info@aschauffeured.com.au" style="color:#c8a96b;">info@aschauffeured.com.au</a>
      </p>'
  )
)
ON CONFLICT (tenant_id, event_type, channel)
DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();

END $$;
