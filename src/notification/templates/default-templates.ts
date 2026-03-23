// ─────────────────────────────────────────────────────────────────────────────
// Chauffeur Solutions — Platform Default Notification Templates
// All 33 events | inline styles | 600px max-width | en-AU locale
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared style tokens ───────────────────────────────────────────────────────
const S = {
  wrap: 'font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a;background:#ffffff',
  h2: 'font-size:22px;font-weight:700;margin:0 0 16px',
  p: 'font-size:15px;line-height:1.6;margin:0 0 12px;color:#374151',
  table: 'width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden',
  tdL: 'padding:11px 14px;color:#6b7280;font-size:14px;width:42%;border-bottom:1px solid #f3f4f6',
  tdR: 'padding:11px 14px;font-weight:500;font-size:14px;border-bottom:1px solid #f3f4f6',
  tdLAlt: 'padding:11px 14px;color:#6b7280;font-size:14px;width:42%;border-bottom:1px solid #f3f4f6;background:#f9fafb',
  tdRAlt: 'padding:11px 14px;font-weight:500;font-size:14px;border-bottom:1px solid #f3f4f6;background:#f9fafb',
  tdTotal: 'padding:13px 14px;font-weight:700;font-size:16px;border-top:2px solid #e5e7eb',
  divider: 'border:none;border-top:2px solid #e5e7eb;margin:24px 0',
  footer: 'font-size:12px;color:#9ca3af;text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #f3f4f6',
};

const btn = (label: string, color = '#2563eb') =>
  `<a href="{{${label.toLowerCase().replace(/\s+/g, '_')}_url}}" style="display:inline-block;background:${color};color:#ffffff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:4px 6px">${label}</a>`;

const btnUrl = (label: string, url: string, color = '#2563eb') =>
  `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:4px 6px">${label}</a>`;

const cta = (inner: string) =>
  `<p style="text-align:center;margin:28px 0">${inner}</p>`;

const footer = () =>
  `<p style="${S.footer}">Thank you for choosing <strong>{{company_name}}</strong>. Questions? Contact us at any time.</p>`;

// ── Booking summary rows (shared across multiple templates) ───────────────────
const bookingRows = (includePricing = true) => `
  <tr><td style="${S.tdL}">Booking Reference</td><td style="${S.tdR}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Date &amp; Time</td><td style="${S.tdRAlt}"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="${S.tdL}">Pickup</td><td style="${S.tdR}">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="${S.tdLAlt}">Via (Stops)</td><td style="${S.tdRAlt}">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="${S.tdL}">Dropoff</td><td style="${S.tdR}">{{dropoff_address}}</td></tr>
  <tr><td style="${S.tdLAlt}">Vehicle</td><td style="${S.tdRAlt}">{{car_type_name}}</td></tr>
  <tr><td style="${S.tdL}">Passengers</td><td style="${S.tdR}">{{passenger_count}}</td></tr>
  ${includePricing ? `
  <tr><td style="${S.tdLAlt}">Base Fare</td><td style="${S.tdRAlt}">{{currency}} {{base_fare}}</td></tr>
  <tr><td style="${S.tdL}">Toll / Parking</td><td style="${S.tdR}">{{currency}} {{toll_parking_total}}</td></tr>
  <tr><td style="${S.tdLAlt}">Extras</td><td style="${S.tdRAlt}">{{currency}} {{extras_amount}}</td></tr>
  {{#if has_discount}}
  <tr><td style="${S.tdL}">Original Price</td><td style="${S.tdR}"><span style="text-decoration:line-through;color:#9ca3af">{{currency}} {{original_price}}</span></td></tr>
  <tr><td style="${S.tdLAlt}">Discount</td><td style="${S.tdRAlt}"><span style="color:#22c55e">− {{currency}} {{discount_amount}}</span></td></tr>
  {{/if}}
  <tr><td style="${S.tdTotal}" colspan="2" style="background:#f0fdf4">
    <span style="color:#6b7280;font-size:14px">Total</span>
    &nbsp;&nbsp;
    <strong style="font-size:18px">{{currency}} {{total_amount}}</strong>
  </td></tr>` : ''}`;

// ─────────────────────────────────────────────────────────────────────────────
export const PLATFORM_DEFAULT_TEMPLATES: Record<
  string,
  { email?: { subject: string; body: string }; sms?: { body: string } }
> = {

  // ══════════════════════════════════════════════════════════════════════
  // 1. BOOKING CREATED
  // ══════════════════════════════════════════════════════════════════════

  /** Admin creates booking → Payment Request to customer */
  AdminCreatedPaymentRequest: {
    email: {
      subject: 'Payment Required — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Payment Required 💳</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Your booking has been created by <strong>{{company_name}}</strong>. Please review the details below and complete payment to confirm your reservation.</p>
<table style="${S.table}">${bookingRows()}</table>
<p style="${S.p}">This payment link is valid for <strong>24 hours</strong>.</p>
${cta(btnUrl('Review &amp; Pay →', '{{payment_url}}'))}
${footer()}
</div>`,
    },
  },

  /** Customer creates booking → Booking Received confirmation to customer */
  CustomerCreatedBookingReceived: {
    email: {
      subject: 'Booking Received — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Booking Received ✅</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">We have received your booking request. Our team will review and confirm your reservation shortly.</p>
<p style="${S.p}">Once confirmed, <strong>{{currency}} {{total_amount}}</strong> will be charged to your saved payment method.</p>
<table style="${S.table}">${bookingRows()}</table>
<p style="${S.p}" style="color:#6b7280;font-size:13px">You will receive a confirmation email as soon as your booking is reviewed. Please contact {{company_name}} if you have any urgent questions.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} received. We will confirm shortly. Total {{currency}} {{total_amount}}.' },
  },

  /** Customer creates booking → Alert to admins */
  AdminNewBookingAlert: {
    email: {
      subject: 'New Booking — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">🆕 New Booking — Action Required</h2>
<p style="${S.p}">A new booking has been submitted. The customer has saved their payment method and is awaiting confirmation.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Customer</td><td style="${S.tdR}"><strong>{{customer_name}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Email</td><td style="${S.tdRAlt}">{{customer_email}}</td></tr>
  <tr><td style="${S.tdL}">Phone</td><td style="${S.tdR}">{{customer_phone}}</td></tr>
  ${bookingRows()}
</table>
${cta(
  btnUrl('✅ Confirm &amp; Charge', '{{admin_booking_url}}', '#16a34a') +
  btnUrl('✕ Reject Booking', '{{admin_booking_url}}', '#dc2626')
)}
<p style="${S.p};font-size:13px;color:#6b7280;text-align:center">Log in to the admin portal to action this booking.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: New booking {{booking_reference}} from {{customer_name}} on {{pickup_time}}. {{currency}} {{total_amount}}. Login to confirm.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 2. BOOKING CONFIRMED
  // ══════════════════════════════════════════════════════════════════════

  /** Admin confirms and charges → email to customer, SMS to passenger */
  BookingConfirmedCustomer: {
    email: {
      subject: 'Booking Confirmed — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#16a34a">Booking Confirmed ✅</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Your booking <strong>{{booking_reference}}</strong> is confirmed. Payment has been processed successfully.</p>
<table style="${S.table}">${bookingRows()}</table>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Amount Charged</td><td style="${S.tdR}"><strong>{{currency}} {{total_amount}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Charged To</td><td style="${S.tdRAlt}">{{card_brand}} ****{{card_last4}}</td></tr>
</table>
<p style="${S.p};color:#6b7280;font-size:13px">To modify or cancel, please contact {{company_name}} as soon as possible.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} confirmed. {{pickup_time}} from {{pickup_address}}. Charged {{currency}} {{total_amount}}. See you soon!' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 2a. BOOKING REJECTED
  // ══════════════════════════════════════════════════════════════════════

  /** Admin rejects booking → email to customer */
  BookingRejected: {
    email: {
      subject: 'Booking Not Confirmed — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Booking Not Confirmed</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Unfortunately we were unable to confirm your booking <strong>{{booking_reference}}</strong>.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Reason</td><td style="${S.tdR}">{{rejection_reason}}</td></tr>
  <tr><td style="${S.tdLAlt}">Date &amp; Time</td><td style="${S.tdRAlt}">{{pickup_time}}</td></tr>
  <tr><td style="${S.tdL}">Route</td><td style="${S.tdR}">{{pickup_address}} → {{dropoff_address}}</td></tr>
</table>
<p style="${S.p}"><strong>No charge has been made</strong> to your payment method.</p>
${cta(btnUrl('Book Again →', '{{booking_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Need assistance? Contact {{company_name}} and we'll be happy to help.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} could not be confirmed. No charge made. Please contact us to rebook.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 2b. BOOKING MODIFIED
  // ══════════════════════════════════════════════════════════════════════

  /** Admin modifies booking → email to customer */
  BookingModifiedCustomer: {
    email: {
      subject: 'Booking Updated — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Booking Updated 📝</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Your booking <strong>{{booking_reference}}</strong> has been updated by our team. Please review the new details and confirm.</p>
<table style="${S.table}">${bookingRows()}</table>
${cta(btnUrl('Review &amp; Confirm →', '{{admin_booking_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Contact {{company_name}} if you have any questions about the changes.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} updated. Please check your email and confirm the new details.' },
  },

  /** Alias used by system events */
  BookingModified: {
    email: {
      subject: 'Booking Updated — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Booking Updated 📝</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Your booking <strong>{{booking_reference}}</strong> has been updated by our team. Please review the new details and confirm.</p>
<table style="${S.table}">${bookingRows()}</table>
${cta(btnUrl('Review &amp; Confirm →', '{{admin_booking_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Contact {{company_name}} if you have any questions about the changes.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} updated. Please check your email and confirm the new details.' },
  },

  /** Customer requests modification → email to admins */
  BookingModificationRequestAdmin: {
    email: {
      subject: 'Modification Request — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Modification Request 📝</h2>
<p style="${S.p}">A customer has requested changes to an existing booking.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Customer</td><td style="${S.tdR}"><strong>{{customer_name}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Booking Reference</td><td style="${S.tdRAlt}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${S.tdL}">Date &amp; Time</td><td style="${S.tdR}">{{pickup_time}}</td></tr>
  <tr><td style="${S.tdLAlt}">Route</td><td style="${S.tdRAlt}">{{pickup_address}} → {{dropoff_address}}</td></tr>
  <tr><td style="${S.tdL}">Modification Details</td><td style="${S.tdR}">{{modification_details}}</td></tr>
</table>
${cta(btnUrl('Review Booking →', '{{admin_booking_url}}'))}
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Modification request for {{booking_reference}} from {{customer_name}}. Login to review.' },
  },

  BookingChangeProposed: {
    email: {
      subject: 'Booking Change Approval — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Please Approve Changes</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">We have proposed changes to your booking. Please review and approve the changes.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Booking</td><td style="${S.tdR}">{{booking_reference}}</td></tr>
  <tr><td style="${S.tdLAlt}">Pickup</td><td style="${S.tdRAlt}">{{pickup_address}}</td></tr>
  <tr><td style="${S.tdL}">Dropoff</td><td style="${S.tdR}">{{dropoff_address}}</td></tr>
  <tr><td style="${S.tdLAlt}">Date &amp; Time</td><td style="${S.tdRAlt}">{{pickup_time}}</td></tr>
  {{#if modification_details}}<tr><td style="${S.tdL}">Changes</td><td style="${S.tdR}">{{modification_details}}</td></tr>{{/if}}
  {{#if price_delta_minor}}<tr><td style="${S.tdLAlt}">Price Difference</td><td style="${S.tdRAlt}">{{currency}} {{price_delta_minor}}</td></tr>{{/if}}
</table>
${cta(btnUrl('Approve Changes →', '{{approval_url}}', '#16a34a'))}
<p style="${S.p}">If you do not approve, no changes will be applied.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Booking change proposed for {{booking_reference}}. Approve here: {{approval_url}}' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 3. DRIVER STATUS
  // ══════════════════════════════════════════════════════════════════════

  /** Driver en route → SMS to passenger only */
  DriverEnRoute: {
    sms: { body: '{{company_name}}: {{passenger_name}}, your driver {{driver_name}} is on the way — ETA {{eta_minutes}} min. {{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}}).' },
  },

  /** Driver arrived → SMS to passenger only */
  DriverArrived: {
    sms: { body: '{{company_name}}: {{passenger_name}}, your driver has arrived at {{pickup_address}}. {{vehicle_make}} {{vehicle_model}} — Plate: {{vehicle_plate}} — Colour: {{vehicle_colour}}.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 4. JOB FULFILLED
  // ══════════════════════════════════════════════════════════════════════

  /** Trip completed — no extras → customer notification */
  JobFulfilledNoExtras: {
    email: {
      subject: 'Trip Complete — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Trip Complete 🏁</h2>
<p style="${S.p}">Hi {{customer_first_name}}, your trip is complete. Here is your final summary.</p>

<h3 style="font-size:15px;font-weight:600;margin:24px 0 8px;color:#374151">Trip Summary</h3>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Date &amp; Time</td><td style="${S.tdR}">{{pickup_time}}</td></tr>
  <tr><td style="${S.tdLAlt}">Pickup</td><td style="${S.tdRAlt}">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="${S.tdL}">Via</td><td style="${S.tdR}">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="${S.tdL}">Dropoff</td><td style="${S.tdR}">{{dropoff_address}}</td></tr>
  <tr><td style="${S.tdLAlt}">Driver</td><td style="${S.tdRAlt}">{{driver_name}}</td></tr>
  <tr><td style="${S.tdL}">Vehicle</td><td style="${S.tdR}">{{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}})</td></tr>
</table>

<h3 style="font-size:15px;font-weight:600;margin:24px 0 8px;color:#374151">Fare Breakdown</h3>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Base Fare</td><td style="${S.tdR}">{{currency}} {{actual_base_fare}}</td></tr>
  <tr><td style="${S.tdLAlt}">Toll / Parking</td><td style="${S.tdRAlt}">{{currency}} {{actual_toll_parking}}</td></tr>
  <tr><td style="${S.tdL}">Waiting Time</td><td style="${S.tdR}">{{currency}} {{waiting_time_fee}}</td></tr>
  <tr><td style="${S.tdLAlt}">Extras</td><td style="${S.tdRAlt}">{{currency}} {{extras_amount}}</td></tr>
  <tr><td style="${S.tdL}" colspan="2"><hr style="${S.divider};margin:4px 0"></td></tr>
  <tr><td style="${S.tdL}">Part A — Pre-authorised</td><td style="${S.tdR}">{{currency}} {{prepay_amount}}</td></tr>
  <tr><td style="${S.tdLAlt}">Part B — Actual Trip Cost</td><td style="${S.tdRAlt}">{{currency}} {{actual_amount}}</td></tr>
  <tr><td style="${S.tdL}">Adjustment</td><td style="${S.tdR}">{{currency}} {{adjustment_amount}}</td></tr>
  <tr style="border-top:3px solid #e5e7eb">
    <td style="${S.tdTotal}">Grand Total Paid</td>
    <td style="${S.tdTotal};color:#16a34a">{{currency}} {{total_paid}}</td>
  </tr>
</table>

<table style="${S.table}">
  <tr><td style="${S.tdL}">Payment Method</td><td style="${S.tdR}">{{card_brand}} ****{{card_last4}}</td></tr>
</table>

<p style="${S.p};color:#6b7280;font-size:13px">A PDF invoice has been attached to this email for your records.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Trip {{booking_reference}} complete. Total paid {{currency}} {{total_paid}}. Thank you!' },
  },

  /** Trip completed — with extras → customer notification */
  JobFulfilledWithExtras: {
    email: {
      subject: 'Final Invoice — Additional Charges | {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Trip Complete — Additional Charges</h2>
<p style="${S.p}">Hi {{customer_first_name}}, your trip is complete. Additional charges were applied based on actuals.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Pickup</td><td style="${S.tdR}">{{pickup_address}}</td></tr>
  <tr><td style="${S.tdLAlt}">Dropoff</td><td style="${S.tdRAlt}">{{dropoff_address}}</td></tr>
  <tr><td style="${S.tdL}">Pickup Time</td><td style="${S.tdR}">{{pickup_time}}</td></tr>
  <tr><td style="${S.tdLAlt}">Actual Total</td><td style="${S.tdRAlt}">{{actual_total}}</td></tr>
  <tr><td style="${S.tdL}">Extra Charges</td><td style="${S.tdR}">{{adjustment_amount}}</td></tr>
</table>
<p style="${S.p}">If you have any questions, please reply to this email.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Trip {{booking_reference}} completed. Additional charges of {{adjustment_amount}} were applied.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 5. PAYMENT FAILED
  // ══════════════════════════════════════════════════════════════════════

  /** Payment failed → email + SMS to customer */
  PaymentFailedCustomer: {
    email: {
      subject: 'Payment Failed — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Payment Failed ⚠️</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">We were unable to process a payment of <strong>{{currency}} {{amount}}</strong> for booking <strong>{{booking_reference}}</strong>.</p>
<p style="${S.p}">Please update your payment method to avoid any disruption to your booking.</p>
${cta(btnUrl('Update Payment Method →', '{{payment_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Contact {{company_name}} if you need immediate assistance.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Payment FAILED for {{booking_reference}} ({{currency}} {{amount}}). Update payment method urgently: {{payment_url}}' },
  },

  /** Payment failed → email to admins */
  PaymentFailedAdmin: {
    email: {
      subject: 'Payment Failed — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Customer Payment Failed ⚠️</h2>
<p style="${S.p}">A payment for the following booking could not be processed.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Customer</td><td style="${S.tdR}"><strong>{{customer_name}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Booking Reference</td><td style="${S.tdRAlt}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${S.tdL}">Amount</td><td style="${S.tdR}"><strong style="color:#dc2626">{{currency}} {{amount}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Date &amp; Time</td><td style="${S.tdRAlt}">{{pickup_time}}</td></tr>
</table>
${cta(btnUrl('View Booking →', '{{admin_booking_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Please contact the customer to arrange payment.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Payment FAILED — {{booking_reference}}, {{customer_name}}, {{currency}} {{amount}}. Login to action.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 6. ADJUSTMENT
  // ══════════════════════════════════════════════════════════════════════

  /** Part B > Part A → additional charge to customer */
  AdditionalCharge: {
    email: {
      subject: 'Additional Charge — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Additional Charge Applied 💳</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Based on the final trip details for booking <strong>{{booking_reference}}</strong>, an additional charge has been applied.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Part A — Pre-authorised</td><td style="${S.tdR}">{{currency}} {{prepay_amount}}</td></tr>
  <tr><td style="${S.tdLAlt}">Part B — Actual Cost</td><td style="${S.tdRAlt}">{{currency}} {{actual_amount}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb">
    <td style="${S.tdTotal}">Additional Charge</td>
    <td style="${S.tdTotal};color:#dc2626">{{currency}} {{adjustment_amount}}</td>
  </tr>
</table>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Charged To</td><td style="${S.tdR}">{{card_brand}} ****{{card_last4}}</td></tr>
</table>
<p style="${S.p};color:#6b7280;font-size:13px">Contact {{company_name}} if you have any questions about this charge.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Additional {{currency}} {{adjustment_amount}} charged for {{booking_reference}} (Part B adjustment). Questions? Contact us.' },
  },

  /** Part B < Part A → refund to customer */
  RefundIssued: {
    email: {
      subject: 'Refund Issued — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#16a34a">Refund Issued 💰</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">A refund has been processed for booking <strong>{{booking_reference}}</strong>.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Part A — Pre-authorised</td><td style="${S.tdR}">{{currency}} {{prepay_amount}}</td></tr>
  <tr><td style="${S.tdLAlt}">Part B — Actual Cost</td><td style="${S.tdRAlt}">{{currency}} {{actual_amount}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb">
    <td style="${S.tdTotal}">Refund Amount</td>
    <td style="${S.tdTotal};color:#16a34a">{{currency}} {{refund_amount}}</td>
  </tr>
</table>
<p style="${S.p}">Please allow <strong>5–10 business days</strong> for the funds to appear in your account.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Refund {{currency}} {{refund_amount}} issued for {{booking_reference}}. Allow 5-10 business days.' },
  },

  /** Adjustment charge failed → email to admins */
  AdjustmentFailedAdmin: {
    email: {
      subject: 'Adjustment Failed — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Adjustment Charge Failed ⚠️</h2>
<p style="${S.p}">The post-trip adjustment charge for the following booking could not be processed. Manual action is required.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Customer</td><td style="${S.tdR}"><strong>{{customer_name}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Booking Reference</td><td style="${S.tdRAlt}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${S.tdL}">Amount</td><td style="${S.tdR}"><strong style="color:#dc2626">{{currency}} {{adjustment_amount}}</strong></td></tr>
</table>
${cta(btnUrl('View Booking →', '{{admin_booking_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Please contact the customer to arrange manual payment of the outstanding amount.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Adjustment FAILED — {{booking_reference}}, {{customer_name}}, {{currency}} {{adjustment_amount}}. Manual action required.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 7. INVOICE
  // ══════════════════════════════════════════════════════════════════════

  /** Invoice sent → email + SMS to customer */
  InvoiceSent: {
    email: {
      subject: 'Invoice {{invoice_number}} — {{company_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Invoice 📄</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Please find your invoice details below.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Invoice Number</td><td style="${S.tdR}"><strong>{{invoice_number}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Amount Due</td><td style="${S.tdRAlt}"><strong>{{currency}} {{total_amount}}</strong></td></tr>
  <tr><td style="${S.tdL}">Due Date</td><td style="${S.tdR};color:#dc2626"><strong>{{due_date}}</strong></td></tr>
</table>
<p style="${S.p};color:#6b7280;font-size:13px">A PDF invoice is attached to this email for your records.</p>
${cta(btnUrl('Pay Now →', '{{pay_url}}'))}
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} — {{currency}} {{total_amount}} due {{due_date}}. Pay: {{pay_url}}' },
  },

  /** Invoice overdue → email + SMS to customer */
  InvoiceOverdue: {
    email: {
      subject: 'Invoice Overdue — {{invoice_number}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Invoice Overdue ⚠️</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Invoice <strong>{{invoice_number}}</strong> is now overdue. Please action immediately to avoid further penalties.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Invoice Number</td><td style="${S.tdR}"><strong>{{invoice_number}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Amount Overdue</td><td style="${S.tdRAlt}"><strong style="color:#dc2626">{{currency}} {{total_amount}}</strong></td></tr>
  <tr><td style="${S.tdL}">Original Due Date</td><td style="${S.tdR}">{{due_date}}</td></tr>
</table>
${cta(btnUrl('Pay Now →', '{{pay_url}}', '#dc2626'))}
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: OVERDUE — Invoice {{invoice_number}} {{currency}} {{total_amount}} was due {{due_date}}. Pay now: {{pay_url}}' },
  },

  /** Invoice paid → email to admins only */
  InvoicePaidAdmin: {
    email: {
      subject: 'Invoice Paid — {{invoice_number}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#16a34a">Invoice Paid ✅</h2>
<p style="${S.p}">Payment has been received for the following invoice.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Invoice Number</td><td style="${S.tdR}"><strong>{{invoice_number}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Customer</td><td style="${S.tdRAlt}"><strong>{{customer_name}}</strong></td></tr>
  <tr><td style="${S.tdL}">Amount Received</td><td style="${S.tdR}"><strong>{{currency}} {{total_amount}}</strong></td></tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} paid — {{currency}} {{total_amount}} from {{customer_name}}.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 8. AUTH
  // ══════════════════════════════════════════════════════════════════════

  /** New account → email + SMS to customer */
  CustomerEmailVerification: {
    email: {
      subject: 'Verify Your Email — {{company_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Verify Your Email</h2>
<p style="${S.p}">Hi {{customer_name}},</p>
<p style="${S.p}">Please use the code below to verify your email address. This code is valid for <strong>15 minutes</strong>.</p>
<div style="text-align:center;margin:32px 0">
  <div style="display:inline-block;background:#0d0f14;border:2px solid #c8a96b;border-radius:12px;padding:18px 40px">
    <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#c8a96b">{{otp_code}}</span>
  </div>
</div>
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">If you did not request this, please ignore this email.</p>
${footer()}
</div>`,
    },
  },

  CustomerRegistered: {
    email: {
      subject: 'Welcome to {{company_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Welcome to {{company_name}}! 🎉</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">Your account has been created. You can now book, manage and track your rides online.</p>
${cta(btnUrl('Book a Ride →', '{{booking_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">Need help? Contact {{company_name}} at any time — we're here 24/7.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Welcome {{customer_first_name}}! Your account is ready. Book your ride anytime at {{booking_url}}' },
  },

  /** Forgot password → email only */
  CustomerForgotPassword: {
    email: {
      subject: 'Reset Your Password — {{company_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Reset Your Password 🔐</h2>
<p style="${S.p}">Hi {{customer_first_name}},</p>
<p style="${S.p}">We received a request to reset your password. Click below — this link is valid for <strong>1 hour</strong>.</p>
${cta(btnUrl('Reset Password →', '{{reset_url}}'))}
<p style="${S.p};color:#6b7280;font-size:13px;text-align:center">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>
${footer()}
</div>`,
    },
  },

  /** OTP → SMS only */
  CustomerOtpSent: {
    sms: { body: '{{company_name}}: Your verification code is {{otp_code}}. Valid for 10 minutes. Do not share this code with anyone.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 9. DRIVER EVENTS
  // ══════════════════════════════════════════════════════════════════════

  /** Driver assigned → email + SMS */
  DriverJobAssigned: {
    email: {
      subject: 'New Job — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">New Job Assignment 🚗</h2>
<p style="${S.p}">Hi {{driver_name}}, you have a new job. Please confirm or decline in the app.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Booking Reference</td><td style="${S.tdR}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Date &amp; Time</td><td style="${S.tdRAlt}"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="${S.tdL}">Pickup</td><td style="${S.tdR}"><strong>{{pickup_address}}</strong></td></tr>
  {{#if waypoint_count}}<tr><td style="${S.tdLAlt}">Via</td><td style="${S.tdRAlt}">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="${S.tdL}">Dropoff</td><td style="${S.tdR}"><strong>{{dropoff_address}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Passenger</td><td style="${S.tdRAlt}"><strong>{{passenger_name}}</strong> — {{passenger_phone}}</td></tr>
  <tr><td style="${S.tdL}">Pax / Luggage</td><td style="${S.tdR}">{{passenger_count}} pax / {{luggage_count}} bags</td></tr>
  <tr><td style="${S.tdLAlt}">Special Requests</td><td style="${S.tdRAlt}">{{special_requests}}</td></tr>
</table>
<h3 style="font-size:15px;font-weight:600;margin:24px 0 8px;color:#374151">Your Pay</h3>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Base Pay</td><td style="${S.tdR}">{{currency}} {{driver_pay_amount}}</td></tr>
  <tr><td style="${S.tdLAlt}">Toll / Parking Reimbursement</td><td style="${S.tdRAlt}">{{currency}} {{driver_toll_parking}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb">
    <td style="${S.tdTotal}">Your Total</td>
    <td style="${S.tdTotal};color:#16a34a">{{currency}} {{driver_total}}</td>
  </tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: New job {{booking_reference}} on {{pickup_time}}. Pick up {{passenger_name}} from {{pickup_address}}. Pay: {{currency}} {{driver_total}}. Confirm in app.' },
  },

  /** Job cancelled → email + SMS to driver */
  DriverJobCancelled: {
    email: {
      subject: 'Job Cancelled — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Job Cancelled</h2>
<p style="${S.p}">Hi {{driver_name}},</p>
<p style="${S.p}">Job <strong>{{booking_reference}}</strong> ({{pickup_time}}) has been cancelled.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Reason</td><td style="${S.tdR}">{{cancellation_reason}}</td></tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} ({{pickup_time}}) cancelled. Reason: {{cancellation_reason}}' },
  },

  /** Pay updated → email + SMS to driver */
  DriverPayUpdated: {
    email: {
      subject: 'Pay Updated — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Pay Updated 💰</h2>
<p style="${S.p}">Hi {{driver_name}},</p>
<p style="${S.p}">The pay for job <strong>{{booking_reference}}</strong> has been updated. Please review and re-confirm in the app.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Base Pay</td><td style="${S.tdR}">{{currency}} {{driver_pay_amount}}</td></tr>
  <tr><td style="${S.tdLAlt}">Toll / Parking</td><td style="${S.tdRAlt}">{{currency}} {{driver_toll_parking}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb">
    <td style="${S.tdTotal}">New Total</td>
    <td style="${S.tdTotal};color:#16a34a">{{currency}} {{driver_total}}</td>
  </tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Pay updated for {{booking_reference}} — new total {{currency}} {{driver_total}}. Please re-confirm in app.' },
  },

  /** Document expiry soon → email + SMS to driver */
  DriverDocumentExpirySoon: {
    email: {
      subject: 'Document Expiry Reminder — {{document_type}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#d97706">Document Expiring Soon ⚠️</h2>
<p style="${S.p}">Hi {{driver_name}},</p>
<p style="${S.p}">Your <strong>{{document_type}}</strong> is due to expire on <strong>{{expiry_date}}</strong>. Please renew and upload the updated document before it expires to avoid account suspension.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} expires {{expiry_date}}. Please renew now to avoid account suspension.' },
  },

  /** Account suspended → email + SMS to driver */
  DriverAccountSuspended: {
    email: {
      subject: 'Account Suspended',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Account Suspended ❌</h2>
<p style="${S.p}">Hi {{driver_name}},</p>
<p style="${S.p}">Your account has been suspended due to an expired <strong>{{document_type}}</strong>. Please upload the updated document immediately to reactivate your account.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Account SUSPENDED — {{document_type}} expired. Upload updated document immediately to reactivate.' },
  },

  /** Document approved → email + SMS to driver */
  DriverDocumentApproved: {
    email: {
      subject: 'Document Approved — {{document_type}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#16a34a">Document Approved ✅</h2>
<p style="${S.p}">Hi {{driver_name}},</p>
<p style="${S.p}">Your <strong>{{document_type}}</strong> has been reviewed and approved. Your account is fully active.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} has been approved. Account is active — ready to take jobs!' },
  },

  /** Document rejected → email + SMS to driver */
  DriverDocumentRejected: {
    email: {
      subject: 'Document Rejected — {{document_type}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#dc2626">Document Rejected ❌</h2>
<p style="${S.p}">Hi {{driver_name}},</p>
<p style="${S.p}">Your <strong>{{document_type}}</strong> was rejected. Please re-upload the correct document.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Reason</td><td style="${S.tdR}">{{rejection_reason}}</td></tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: {{document_type}} rejected — {{rejection_reason}}. Please re-upload the correct document.' },
  },

  /** Job completed → email to admin */
  DriverJobCompleted: {
    email: {
      subject: 'Job Completed — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Job Completed ✅</h2>
<p style="${S.p}">Driver {{driver_name}} marked booking <strong>{{booking_reference}}</strong> as completed.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Pickup</td><td style="${S.tdR}">{{pickup_address}}</td></tr>
  <tr><td style="${S.tdLAlt}">Dropoff</td><td style="${S.tdRAlt}">{{dropoff_address}}</td></tr>
  <tr><td style="${S.tdL}">Pickup Time</td><td style="${S.tdR}">{{pickup_time}}</td></tr>
</table>
${cta(btnUrl('Review Booking →', '{{admin_booking_url}}'))}
${footer()}
</div>`,
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // 10. PLATFORM / SUPER ADMIN
  // ══════════════════════════════════════════════════════════════════════

  /** New driver review → email + SMS to Super Admin */
  PlatformNewDriverReview: {
    email: {
      subject: 'New Driver Review — {{driver_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">New Driver Review 🔍</h2>
<p style="${S.p}">A new driver has applied for certification and requires review.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Driver</td><td style="${S.tdR}"><strong>{{driver_name}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Tenant</td><td style="${S.tdRAlt}"><strong>{{tenant_name}}</strong></td></tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: 'New driver review: {{driver_name}} ({{tenant_name}}). Login to review.' },
  },

  /** New connection request → email + SMS to Super Admin */
  PlatformNewConnectionReview: {
    email: {
      subject: 'New Connection Request',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">New Partnership Review 🔗</h2>
<p style="${S.p}">Two tenants have requested a partnership and require platform approval.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Tenant A</td><td style="${S.tdR}"><strong>{{tenant_name}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">Tenant B</td><td style="${S.tdRAlt}"><strong>{{partner_name}}</strong></td></tr>
</table>
${footer()}
</div>`,
    },
    sms: { body: 'New connection review: {{tenant_name}} + {{partner_name}}. Login to approve.' },
  },

  /** New tenant registered → email + SMS to Super Admin */
  PlatformNewTenant: {
    email: {
      subject: 'New Tenant Registration — {{tenant_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">New Tenant Registration 🏢</h2>
<p style="${S.p}"><strong>{{tenant_name}}</strong> has registered on the platform. Please review and activate their account.</p>
${footer()}
</div>`,
    },
    sms: { body: 'New tenant registered: {{tenant_name}}. Login to activate.' },
  },

  /** Partnership approved → email + SMS to tenant Admin */
  AdminConnectionApproved: {
    email: {
      subject: 'Partnership Approved — {{partner_name}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2};color:#16a34a">Partnership Established ✅</h2>
<p style="${S.p}">Your partnership with <strong>{{partner_name}}</strong> has been approved by the platform. You can now transfer bookings between each other.</p>
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Partnership with {{partner_name}} approved. You can now share and receive bookings!' },
  },

  /** Transfer received → email + SMS to tenant Admin */
  AdminTransferReceived: {
    email: {
      subject: 'Transfer Request — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Transfer Request 📦</h2>
<p style="${S.p}"><strong>{{from_tenant_name}}</strong> has transferred a booking to your company. Please accept or decline in the admin portal.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Booking Reference</td><td style="${S.tdR}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${S.tdLAlt}">From</td><td style="${S.tdRAlt}"><strong>{{from_tenant_name}}</strong></td></tr>
  ${bookingRows(false)}
  <tr style="border-top:2px solid #e5e7eb">
    <td style="${S.tdTotal}">Transfer Price</td>
    <td style="${S.tdTotal};color:#16a34a">{{currency}} {{transfer_price}}</td>
  </tr>
</table>
${cta(btnUrl('Accept Transfer →', '{{admin_booking_url}}', '#16a34a'))}
${footer()}
</div>`,
    },
    sms: { body: '{{company_name}}: Transfer request — {{booking_reference}} from {{from_tenant_name}} on {{pickup_time}}. Price {{currency}} {{transfer_price}}. Login to accept.' },
  },

  // ══════════════════════════════════════════════════════════════════════
  // Legacy / internal aliases (kept for backward compat)
  // ══════════════════════════════════════════════════════════════════════

  BookingConfirmed: {
    email: {
      subject: 'Booking Confirmed — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#16a34a">Booking Confirmed ✅</h2><p style="${S.p}">Hi {{customer_first_name}},</p><p style="${S.p}">Booking <strong>{{booking_reference}}</strong> is confirmed. Total charged: <strong>{{currency}} {{total_amount}}</strong>.</p>${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} confirmed. {{pickup_time}} from {{pickup_address}}.' },
  },

  BookingCancelled: {
    email: {
      subject: 'Booking Cancelled {{cancelled_by_label}}— {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#dc2626">Booking Cancelled</h2><p style="${S.p}">Hi {{customer_first_name}},</p><p style="${S.p}">Booking <strong>{{booking_reference}}</strong> has been cancelled{{cancellation_reason_line}}. No charge has been made.</p>${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} cancelled. Contact us if you need help.' },
  },

  AdminNewBooking: {
    email: {
      subject: '🆕 New Booking — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">New Booking Received</h2><p style="${S.p}">Customer <strong>{{customer_name}}</strong> submitted booking <strong>{{booking_reference}}</strong> on {{pickup_time}}.</p>${cta(btnUrl('View Booking →', '{{admin_booking_url}}'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: New booking {{booking_reference}} from {{customer_name}}. Login to action.' },
  },

  AdminBookingPendingConfirm: {
    email: {
      subject: '⏳ Pending Confirmation — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Booking Pending Confirmation ⏳</h2><p style="${S.p}">Booking <strong>{{booking_reference}}</strong> from <strong>{{customer_name}}</strong> is awaiting your action.</p>${cta(btnUrl('Confirm &amp; Charge →', '{{admin_booking_url}}', '#16a34a'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} pending confirmation. Login to action.' },
  },

  AdminBookingConfirmedPaid: {
    email: {
      subject: '💰 Payment Received — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#16a34a">Payment Received 💰</h2><p style="${S.p}">Booking <strong>{{booking_reference}}</strong> from <strong>{{customer_name}}</strong> has been paid in full.</p><p style="${S.p}">Amount: <strong>{{currency}} {{total_price}}</strong> · Pickup: {{pickup_time}}</p>${cta(btnUrl('View Booking →', '{{admin_booking_url}}'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Payment received for {{booking_reference}} — {{currency}} {{total_price}}. Booking confirmed.' },
  },

  JobCompleted: {
    email: {
      subject: 'Trip Complete — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Trip Complete 🏁</h2><p style="${S.p}">Hi {{customer_first_name}}, your trip is complete. Total: <strong>{{currency}} {{total_amount}}</strong>. Thank you!</p>${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Trip {{booking_reference}} complete. Total {{currency}} {{total_amount}}. Thank you!' },
  },

  PaymentRequest: {
    email: {
      subject: 'Payment Required — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Payment Required 💳</h2><p style="${S.p}">Hi {{customer_first_name}}, please complete payment for booking <strong>{{booking_reference}}</strong>.</p>${cta(btnUrl('Pay Now →', '{{payment_url}}'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Payment required for {{booking_reference}}. Pay: {{payment_url}}' },
  },

  TripStarted: {
    sms: { body: '{{company_name}}: {{passenger_name}}, your trip {{booking_reference}} has started. Enjoy your ride!' },
  },

  DriverJobAssigned: {
    email: {
      subject: 'New Job — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">New Job Assignment 🚗</h2><p style="${S.p}">Hi {{driver_name}}, job <strong>{{booking_reference}}</strong> on {{pickup_time}}. Pickup: {{pickup_address}}.</p>${cta(btnUrl('Open Job →', '{{driver_app_url}}'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: New job {{booking_reference}} on {{pickup_time}}. Pickup: {{pickup_address}}. Open: {{driver_app_url}}' },
  },

  DriverInvitationSent: {
    email: {
      subject: 'You are invited to join {{company_name}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Driver Invitation</h2><p style="${S.p}">Hi {{driver_name}},</p><p style="${S.p}">You've been invited to join {{company_name}} as a driver.</p>${cta(btnUrl('Open App →', '{{driver_app_url}}'))}${footer()}</div>`,
    },
    sms: { body: 'You are invited to join {{company_name}}. Open: {{driver_app_url}}' },
  },

  DriverAcceptedAssignment: {
    email: {
      subject: 'Driver Accepted — {{booking_reference}}',
      body: `<div style="${S.wrap}">
<h2 style="${S.h2}">Driver Accepted ✅</h2>
<p style="${S.p}">Driver <strong>{{driver_name}}</strong> has accepted booking <strong>{{booking_reference}}</strong>.</p>
<table style="${S.table}">
  <tr><td style="${S.tdL}">Pickup</td><td style="${S.tdR}">{{pickup_address}}</td></tr>
  <tr><td style="${S.tdLAlt}">Dropoff</td><td style="${S.tdRAlt}">{{dropoff_address}}</td></tr>
  <tr><td style="${S.tdL}">Pickup Time</td><td style="${S.tdR}">{{pickup_time}}</td></tr>
</table>
${cta(btnUrl('Open Booking →', '{{admin_booking_url}}'))}
${footer()}
</div>`,
    },
  },

  DriverRejectedAssignment: {
    email: {
      subject: '⚠️ Driver Rejected Job — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#dc2626">Driver Rejected Job ⚠️</h2><p style="${S.p}"><strong>{{driver_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Please reassign immediately.</p>${cta(btnUrl('Reassign →', '{{admin_booking_url}}', '#dc2626'))}${footer()}</div>`,
    },
    sms: { body: 'ALERT: {{driver_name}} rejected job {{booking_reference}}. Please reassign.' },
  },

  PaymentSuccess: {
    email: {
      subject: 'Payment Confirmed — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#16a34a">Payment Confirmed ✅</h2><p style="${S.p}">Hi {{customer_first_name}}, payment of <strong>{{currency}} {{total_amount}}</strong> confirmed for booking <strong>{{booking_reference}}</strong>.</p>${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Payment {{currency}} {{total_amount}} confirmed for {{booking_reference}}.' },
  },

  PaymentFailed: {
    email: {
      subject: 'Payment Failed — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#dc2626">Payment Failed ⚠️</h2><p style="${S.p}">Hi {{customer_first_name}}, payment failed for booking <strong>{{booking_reference}}</strong>. Please update your payment method.</p>${cta(btnUrl('Update Payment →', '{{payment_url}}'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Payment failed for {{booking_reference}}. Update payment: {{payment_url}}' },
  },

  AdminPaymentFailed: {
    email: {
      subject: '⚠️ Payment Failed — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#dc2626">Customer Payment Failed ⚠️</h2><p style="${S.p}"><strong>{{customer_name}}</strong> — payment of <strong>{{currency}} {{total_amount}}</strong> failed for booking <strong>{{booking_reference}}</strong>.</p>${cta(btnUrl('View Booking →', '{{admin_booking_url}}'))}${footer()}</div>`,
    },
    sms: { body: '{{company_name}}: Payment failed {{booking_reference}} ({{customer_name}} {{currency}} {{total_amount}}). Login to action.' },
  },

  AdminDriverRejected: {
    email: {
      subject: '⚠️ Driver Rejected Job — {{booking_reference}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2};color:#dc2626">Driver Rejected ⚠️</h2><p style="${S.p}"><strong>{{driver_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>.</p>${cta(btnUrl('Reassign →', '{{admin_booking_url}}', '#dc2626'))}${footer()}</div>`,
    },
    sms: { body: '{{driver_name}} rejected {{booking_reference}}. Please reassign.' },
  },

  AdminSettlement: {
    email: {
      subject: 'Settlement Processed',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Settlement Processed 💰</h2><p style="${S.p}">Settlement of <strong>{{currency}} {{total_amount}}</strong> has been processed.</p>${footer()}</div>`,
    },
    sms: { body: 'Settlement processed: {{currency}} {{total_amount}}.' },
  },

  SuperAdminDriverReview: {
    email: {
      subject: 'Driver Review — {{driver_name}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Driver Review</h2><p style="${S.p}">Driver <strong>{{driver_name}}</strong> ({{tenant_name}}) requires platform review.</p>${footer()}</div>`,
    },
    sms: { body: 'Driver review: {{driver_name}} ({{tenant_name}}).' },
  },

  SuperAdminCollabReview: {
    email: {
      subject: 'Partnership Review',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">Partnership Review</h2><p style="${S.p}"><strong>{{tenant_name}}</strong> + <strong>{{partner_name}}</strong> partnership review required.</p>${footer()}</div>`,
    },
    sms: { body: 'Partnership review: {{tenant_name}} + {{partner_name}}.' },
  },

  SuperAdminNewTenant: {
    email: {
      subject: 'New Tenant — {{tenant_name}}',
      body: `<div style="${S.wrap}"><h2 style="${S.h2}">New Tenant Registration</h2><p style="${S.p}"><strong>{{tenant_name}}</strong> has registered. Please review and activate.</p>${footer()}</div>`,
    },
    sms: { body: 'New tenant: {{tenant_name}}. Login to activate.' },
  },
};
