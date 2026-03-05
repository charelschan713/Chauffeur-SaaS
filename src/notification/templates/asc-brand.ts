/**
 * ASChauffeured branded email HTML wrapper
 * Dark theme: #1A1A1A bg, #C8963E gold accents
 */

export interface AscEmailRow {
  label: string;
  value: string;
  isLink?: boolean;
  linkHref?: string;
}

export interface AscEmailSection {
  heading?: string; // gold uppercase section title
  rows: AscEmailRow[];
}

export interface AscBrandedEmailOptions {
  title: string;          // e.g. "Booking Confirmed"
  subtitle?: string;      // e.g. "Your booking is confirmed"
  bookingRef?: string;    // e.g. "ASC-20250305-001"
  sections: AscEmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function ascBrandedEmail(opts: AscBrandedEmailOptions): string {
  const gold = '#C8963E';
  const bg = '#141414';
  const card = '#1E1E1E';
  const border = '#2E2E2E';
  const textPrimary = '#FFFFFF';
  const textLabel = '#888888';
  const textMuted = '#666666';
  const linkColor = '#6AADDF';

  function row(label: string, value: string, isLink = false, href = '') {
    const valHtml = isLink
      ? `<a href="${href}" style="color:${linkColor};text-decoration:underline;">${value}</a>`
      : `<span style="color:${textPrimary};">${value}</span>`;
    return `
      <tr>
        <td style="padding:11px 20px;border-bottom:1px solid ${border};color:${textLabel};font-size:13px;width:30%;vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:11px 20px;border-bottom:1px solid ${border};font-size:13px;vertical-align:top;">${valHtml}</td>
      </tr>`;
  }

  function sectionHeader(heading: string) {
    return `
      <tr>
        <td colspan="2" style="padding:12px 20px 10px;background:${card};border-top:1px solid ${border};">
          <span style="color:${gold};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${heading}</span>
        </td>
      </tr>`;
  }

  const sectionsHtml = opts.sections.map(s => {
    const heading = s.heading ? sectionHeader(s.heading) : '';
    const rows = s.rows.map(r => row(r.label, r.value, r.isLink, r.linkHref)).join('');
    return heading + rows;
  }).join('');

  const ctaHtml = opts.ctaLabel && opts.ctaUrl ? `
    <tr>
      <td colspan="2" style="padding:20px;">
        <a href="${opts.ctaUrl}"
           style="display:inline-block;background:${gold};color:#000000;font-size:13px;font-weight:700;
                  padding:11px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.5px;">
          ${opts.ctaLabel}
        </a>
      </td>
    </tr>` : '';

  const bookingRefHtml = opts.bookingRef ? `
    <tr>
      <td colspan="2" style="padding:14px 20px 0;border-bottom:1px solid ${border};">
        <div style="color:${textLabel};font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">BOOKING</div>
        <div style="color:${gold};font-size:18px;font-weight:700;letter-spacing:0.5px;padding-bottom:14px;">#${opts.bookingRef}</div>
      </td>
    </tr>` : '';

  const footerNote = opts.footerNote
    ? `<p style="color:${textMuted};font-size:12px;margin:8px 0 0;">${opts.footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:${card};border-radius:8px;overflow:hidden;border:1px solid ${border};">

          <!-- Header -->
          <tr>
            <td colspan="2" style="padding:28px 20px 20px;border-bottom:1px solid ${border};">
              <div style="color:${textLabel};font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">
                ASChauffeured
              </div>
              <div style="color:${textPrimary};font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ${opts.title}
              </div>
              ${opts.subtitle ? `<div style="color:${textLabel};font-size:13px;margin-top:5px;">${opts.subtitle}</div>` : ''}
            </td>
          </tr>

          ${bookingRefHtml}

          <!-- Sections -->
          ${sectionsHtml}

          ${ctaHtml}

        </table>

        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin-top:24px;">
          <tr>
            <td style="text-align:center;padding:0 16px;">
              <p style="color:${textMuted};font-size:12px;margin:0;">
                © ${new Date().getFullYear()} ASChauffeured. All rights reserved.
              </p>
              <p style="color:${textMuted};font-size:12px;margin:6px 0 0;">
                <a href="mailto:info@aschauffeured.com.au" style="color:${linkColor};text-decoration:none;">info@aschauffeured.com.au</a>
                &nbsp;·&nbsp;
                <a href="tel:1300010272" style="color:${linkColor};text-decoration:none;">1300 010 272</a>
              </p>
              ${footerNote}
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Per-event HTML builders ──────────────────────────────────────────────────

export function ascBookingConfirmedEmail(vars: Record<string, string>): string {
  const sections: AscEmailSection[] = [
    {
      rows: [
        { label: 'Service', value: vars.service_type_name || '—' },
        { label: 'City', value: vars.city || 'Sydney' },
        { label: 'Vehicle', value: vars.car_type_name || '—' },
      ],
    },
    {
      heading: 'TRIP DETAILS',
      rows: [
        { label: 'Date & Time', value: vars.pickup_time || '—' },
        { label: 'Pickup', value: vars.pickup_address || '—' },
        { label: 'Drop-off', value: vars.dropoff_address || '—' },
        ...(vars.waypoints ? [{ label: 'Stops', value: vars.waypoints }] : []),
        { label: 'Passengers', value: vars.passenger_count || '—' },
        { label: 'Passenger', value: vars.passenger_name || vars.customer_name || '—' },
        ...(vars.passenger_phone ? [{ label: 'Contact', value: vars.passenger_phone }] : []),
        ...(vars.baby_seat_detail ? [{ label: 'Baby/Child Seats', value: vars.baby_seat_detail }] : []),
        ...(vars.special_requests ? [{ label: 'Special Instructions', value: vars.special_requests }] : []),
      ],
    },
    {
      heading: 'PAYMENT',
      rows: [
        { label: 'Total', value: vars.total_price ? `${vars.currency || 'AUD'} ${vars.total_price}` : '—' },
        { label: 'Status', value: vars.payment_status || 'UNPAID' },
      ],
    },
  ];

  return ascBrandedEmail({
    title: 'Booking Confirmed',
    subtitle: 'Your booking has been confirmed.',
    bookingRef: vars.booking_reference,
    sections,
  });
}

export function ascBookingCancelledEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Booking Cancelled',
    bookingRef: vars.booking_reference,
    sections: [
      {
        rows: [
          { label: 'Service', value: vars.service_type_name || '—' },
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup', value: vars.pickup_address || '—' },
          { label: 'Drop-off', value: vars.dropoff_address || '—' },
          ...(vars.cancel_reason ? [{ label: 'Reason', value: vars.cancel_reason }] : []),
        ],
      },
    ],
    footerNote: 'If you have any questions, please contact us.',
  });
}

export function ascDriverAcceptedEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Driver Assigned',
    subtitle: 'Your driver is on their way.',
    bookingRef: vars.booking_reference,
    sections: [
      {
        heading: 'YOUR DRIVER',
        rows: [
          { label: 'Driver', value: vars.driver_name || '—' },
          ...(vars.driver_phone ? [{ label: 'Contact', value: vars.driver_phone }] : []),
          ...(vars.vehicle_name ? [{ label: 'Vehicle', value: vars.vehicle_name }] : []),
          ...(vars.vehicle_plate ? [{ label: 'Plate', value: vars.vehicle_plate }] : []),
        ],
      },
      {
        heading: 'TRIP DETAILS',
        rows: [
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup', value: vars.pickup_address || '—' },
          { label: 'Drop-off', value: vars.dropoff_address || '—' },
        ],
      },
    ],
  });
}

export function ascJobCompletedEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Trip Completed',
    subtitle: 'Thank you for choosing ASChauffeured.',
    bookingRef: vars.booking_reference,
    sections: [
      {
        rows: [
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup', value: vars.pickup_address || '—' },
          { label: 'Drop-off', value: vars.dropoff_address || '—' },
          { label: 'Total', value: vars.total_price ? `${vars.currency || 'AUD'} ${vars.total_price}` : '—' },
          { label: 'Payment', value: vars.payment_status || '—' },
        ],
      },
    ],
    footerNote: 'We hope to see you again soon.',
  });
}

export function ascPaymentLinkEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Payment Due',
    subtitle: 'Please complete your payment to confirm your booking.',
    bookingRef: vars.booking_reference,
    sections: [
      {
        rows: [
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup', value: vars.pickup_address || '—' },
          { label: 'Drop-off', value: vars.dropoff_address || '—' },
          { label: 'Amount Due', value: vars.total_price ? `${vars.currency || 'AUD'} ${vars.total_price}` : '—' },
          { label: 'Link Expires', value: vars.payment_token_expires_at || '—' },
        ],
      },
    ],
    ctaLabel: 'Pay Now',
    ctaUrl: vars.payment_url || '#',
  });
}
