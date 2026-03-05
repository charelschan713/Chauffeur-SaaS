/**
 * ASChauffeured branded email HTML
 * Layout: Black header → White body → Dark booking card → Footer
 * Gold: #C5A55A | Header bg: #1A1A1A | Card bg: #2A2A2A
 */

const GOLD    = '#C5A55A';
const HDR_BG  = '#1A1A1A';
const CARD_BG = '#2A2A2A';
const ROW_DIV = '#3A3A3A';
const LBL     = '#999999';
const VAL     = '#FFFFFF';
const BODY_BG = '#F4F4F4';
const BODY_TXT = '#333333';

function cardRow(label: string, value: string, isLink = false): string {
  const val = isLink
    ? `<a href="${value}" style="color:${GOLD};text-decoration:none;">${value}</a>`
    : `<span style="color:${VAL};">${value}</span>`;
  return `
  <tr>
    <td style="padding:11px 18px;border-bottom:1px solid ${ROW_DIV};color:${LBL};font-size:13px;width:28%;vertical-align:top;white-space:nowrap;font-family:Arial,sans-serif;">${label}</td>
    <td style="padding:11px 18px;border-bottom:1px solid ${ROW_DIV};font-size:13px;vertical-align:top;font-family:Arial,sans-serif;">${val}</td>
  </tr>`;
}

function sectionHead(label: string): string {
  return `
  <tr>
    <td colspan="2" style="padding:12px 18px 10px;border-top:1px solid ${ROW_DIV};background:${CARD_BG};">
      <span style="color:${GOLD};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">${label}</span>
    </td>
  </tr>`;
}

export interface AscEmailSection {
  heading?: string;
  rows: { label: string; value: string; isLink?: boolean }[];
}

export interface AscBrandedEmailOpts {
  title: string;
  introHtml?: string;
  bookingRef?: string;
  sections: AscEmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function ascBrandedEmail(opts: AscBrandedEmailOpts): string {
  const year = new Date().getFullYear();

  const bookingRefBlock = opts.bookingRef ? `
  <tr>
    <td colspan="2" style="padding:14px 18px 4px;">
      <div style="color:${LBL};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">BOOKING</div>
      <div style="color:${GOLD};font-size:17px;font-weight:700;letter-spacing:0.5px;padding:4px 0 10px;font-family:Arial,sans-serif;">#${opts.bookingRef}</div>
    </td>
  </tr>` : '';

  const sectionsHtml = opts.sections.map(s => {
    const h = s.heading ? sectionHead(s.heading) : '';
    const rows = s.rows.map(r => cardRow(r.label, r.value, r.isLink)).join('');
    return h + rows;
  }).join('');

  const ctaBlock = opts.ctaLabel && opts.ctaUrl ? `
  <div style="text-align:center;padding:24px 0 8px;">
    <a href="${opts.ctaUrl}"
       style="display:inline-block;background:${GOLD};color:#000000;font-size:13px;font-weight:700;
              padding:12px 32px;border-radius:4px;text-decoration:none;letter-spacing:0.5px;font-family:Arial,sans-serif;">
      ${opts.ctaLabel}
    </a>
  </div>` : '';

  const introBlock = opts.introHtml
    ? `<p style="color:${BODY_TXT};font-size:14px;line-height:1.6;margin:0 0 20px;font-family:Arial,sans-serif;">${opts.introHtml}</p>`
    : '';

  const footerNote = opts.footerNote
    ? `<p style="color:#999999;font-size:12px;margin:8px 0 0;font-family:Arial,sans-serif;">${opts.footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG};-webkit-font-smoothing:antialiased;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${HDR_BG};">
    <tr>
      <td align="center" style="padding:32px 24px 28px;">
        <div style="color:${GOLD};font-size:22px;font-weight:700;letter-spacing:4px;text-transform:uppercase;font-family:Georgia,serif;margin-bottom:8px;">
          ASCHAUFFEURED
        </div>
        <div style="width:120px;height:1px;background:${GOLD};margin:0 auto 10px;"></div>
        <div style="color:#7A7A7A;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:Arial,sans-serif;">
          Mercedes-Benz &amp; Maybach Specialist Chauffeurs
        </div>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BODY_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Title + intro -->
          <tr>
            <td style="padding:0 0 20px;">
              <h1 style="color:#000000;font-size:22px;font-weight:700;margin:0 0 14px;font-family:Arial,sans-serif;">${opts.title}</h1>
              ${introBlock}
            </td>
          </tr>

          <!-- Dark booking card -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:${CARD_BG};border-radius:8px;overflow:hidden;">
                ${bookingRefBlock}
                ${sectionsHtml}
                ${opts.ctaLabel ? `<tr><td colspan="2" style="padding:20px 18px;">${ctaBlock.trim()}</td></tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="color:#999999;font-size:12px;margin:0;font-family:Arial,sans-serif;">
                &copy; ${year} ASChauffeured. All rights reserved.
              </p>
              <p style="color:#999999;font-size:12px;margin:6px 0 0;font-family:Arial,sans-serif;">
                <a href="mailto:info@aschauffeured.com.au" style="color:${GOLD};text-decoration:none;">info@aschauffeured.com.au</a>
                &nbsp;&middot;&nbsp;
                <a href="tel:1300010272" style="color:${GOLD};text-decoration:none;">1300 010 272</a>
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

// ─── Per-event builders ───────────────────────────────────────────────────────

export function ascBookingConfirmedEmail(vars: Record<string, string>): string {
  const hasReturn = vars.return_pickup_time || vars.return_pickup_address;
  const sections: AscEmailSection[] = [
    {
      rows: [
        { label: 'Service',     value: vars.service_type_name || '—' },
        { label: 'City',        value: vars.city || 'Sydney' },
        { label: 'Vehicle',     value: vars.car_type_name || '—' },
        { label: 'Passengers',  value: vars.passenger_count || '—' },
        { label: 'Passenger',   value: vars.passenger_name || vars.customer_name || '—' },
        ...(vars.passenger_phone ? [{ label: 'Contact', value: vars.passenger_phone }] : []),
        ...(vars.baby_seat_detail ? [{ label: 'Baby/Child Seats', value: vars.baby_seat_detail }] : []),
        ...(vars.special_requests ? [{ label: 'Special Requests', value: vars.special_requests }] : []),
      ],
    },
    {
      heading: hasReturn ? 'OUTBOUND' : 'TRIP DETAILS',
      rows: [
        { label: 'Date & Time', value: vars.pickup_time || '—' },
        { label: 'Pickup',      value: vars.pickup_address || '—' },
        { label: 'Drop-off',    value: vars.dropoff_address || '—' },
        ...(vars.waypoints ? [{ label: 'Stops', value: vars.waypoints }] : []),
      ],
    },
    ...(hasReturn ? [{
      heading: 'RETURN LEG',
      rows: [
        { label: 'Date & Time', value: vars.return_pickup_time || '—' },
        { label: 'Pickup',      value: vars.return_pickup_address || '—' },
        { label: 'Drop-off',    value: vars.dropoff_address || '—' },
      ],
    }] : []),
    {
      heading: 'PAYMENT',
      rows: [
        { label: 'Total',   value: vars.total_price ? `${vars.currency || 'AUD'} ${vars.total_price}` : '—' },
        { label: 'Status',  value: vars.payment_status || 'UNPAID' },
      ],
    },
  ];

  return ascBrandedEmail({
    title: 'Booking Confirmed',
    introHtml: `Booking <strong>#${vars.booking_reference}</strong> has been confirmed.`,
    bookingRef: vars.booking_reference,
    sections,
  });
}

export function ascBookingCancelledEmail(vars: Record<string, string>): string {
  const hasReturn = vars.return_pickup_time || vars.return_pickup_address;
  const cancelledBy = vars.cancelled_by || 'Admin';

  return ascBrandedEmail({
    title: 'Booking Cancelled',
    introHtml: `Booking <strong>#${vars.booking_reference}</strong> has been cancelled by <strong>${cancelledBy}</strong>.`,
    bookingRef: vars.booking_reference,
    sections: [
      {
        rows: [
          { label: 'Service', value: vars.service_type_name || '—' },
          { label: 'City',    value: vars.city || 'Sydney' },
          { label: 'Vehicle', value: vars.car_type_name || '—' },
        ],
      },
      {
        heading: hasReturn ? 'OUTBOUND' : 'TRIP DETAILS',
        rows: [
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup',      value: vars.pickup_address || '—' },
          { label: 'Drop-off',    value: vars.dropoff_address || '—' },
        ],
      },
      ...(hasReturn ? [{
        heading: 'RETURN LEG',
        rows: [
          { label: 'Date & Time', value: vars.return_pickup_time || '—' },
          { label: 'Pickup',      value: vars.return_pickup_address || '—' },
          { label: 'Drop-off',    value: vars.dropoff_address || '—' },
        ],
      }] : []),
      ...(vars.cancel_reason ? [{
        rows: [{ label: 'Reason', value: vars.cancel_reason }],
      }] : []),
    ],
    footerNote: 'If you have any questions, please contact us.',
  });
}

export function ascDriverAcceptedEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Driver Assigned',
    introHtml: `Your driver has been assigned for booking <strong>#${vars.booking_reference}</strong>.`,
    bookingRef: vars.booking_reference,
    sections: [
      {
        heading: 'YOUR DRIVER',
        rows: [
          { label: 'Driver',  value: vars.driver_name || '—' },
          ...(vars.driver_phone   ? [{ label: 'Contact', value: vars.driver_phone }] : []),
          ...(vars.vehicle_name   ? [{ label: 'Vehicle', value: vars.vehicle_name }] : []),
          ...(vars.vehicle_plate  ? [{ label: 'Plate',   value: vars.vehicle_plate }] : []),
        ],
      },
      {
        heading: 'TRIP DETAILS',
        rows: [
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup',      value: vars.pickup_address || '—' },
          { label: 'Drop-off',    value: vars.dropoff_address || '—' },
        ],
      },
    ],
  });
}

export function ascJobCompletedEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Trip Completed',
    introHtml: `Your trip for booking <strong>#${vars.booking_reference}</strong> has been completed. Thank you for choosing ASChauffeured.`,
    bookingRef: vars.booking_reference,
    sections: [
      {
        heading: 'TRIP SUMMARY',
        rows: [
          { label: 'Date & Time', value: vars.pickup_time || '—' },
          { label: 'Pickup',      value: vars.pickup_address || '—' },
          { label: 'Drop-off',    value: vars.dropoff_address || '—' },
          { label: 'Total',       value: vars.total_price ? `${vars.currency || 'AUD'} ${vars.total_price}` : '—' },
          { label: 'Payment',     value: vars.payment_status || '—' },
        ],
      },
    ],
    footerNote: 'We hope to see you again soon.',
  });
}

export function ascPaymentLinkEmail(vars: Record<string, string>): string {
  return ascBrandedEmail({
    title: 'Payment Due',
    introHtml: `Please complete payment for booking <strong>#${vars.booking_reference}</strong> to confirm your trip.`,
    bookingRef: vars.booking_reference,
    sections: [
      {
        heading: 'BOOKING DETAILS',
        rows: [
          { label: 'Date & Time',  value: vars.pickup_time || '—' },
          { label: 'Pickup',       value: vars.pickup_address || '—' },
          { label: 'Drop-off',     value: vars.dropoff_address || '—' },
          { label: 'Amount Due',   value: vars.total_price ? `${vars.currency || 'AUD'} ${vars.total_price}` : '—' },
          { label: 'Link Expires', value: vars.payment_token_expires_at || '—' },
        ],
      },
    ],
    ctaLabel: 'Pay Now',
    ctaUrl: vars.payment_url || '#',
  });
}
