// Shared inline styles
const BASE = `font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a`;
const TABLE = `width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:6px`;
const TD_L = `padding:10px 12px;color:#666;width:42%`;
const TD_R = `padding:10px 12px;font-weight:500`;
const TR_ALT = `background:#f9fafb`;
const BTN = (color: string) =>
  `display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin:8px 4px`;
const DIVIDER = `border:none;border-top:2px solid #e5e7eb;margin:16px 0`;

function bookingSummaryRows(hasPricing = true): string {
  return `
  <tr><td style="${TD_L}">Date &amp; Time</td><td style="${TD_R}"><strong>{{pickup_time}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Pickup</td><td style="${TD_R}">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="${TD_L}">Via</td><td style="${TD_R}">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="${TD_L}">Dropoff</td><td style="${TD_R}">{{dropoff_address}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Vehicle</td><td style="${TD_R}">{{car_type_name}}</td></tr>
  <tr><td style="${TD_L}">Passengers</td><td style="${TD_R}">{{passenger_count}}</td></tr>
  ${hasPricing ? `
  <tr style="${TR_ALT}"><td style="${TD_L}">Base Fare</td><td style="${TD_R}">{{currency}} {{base_fare}}</td></tr>
  <tr><td style="${TD_L}">Toll / Parking</td><td style="${TD_R}">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="${TD_L};font-weight:bold">Total</td><td style="${TD_R};font-weight:bold;font-size:16px">{{currency}} {{total_amount}}</td></tr>` : ''}`;
}

export const PLATFORM_DEFAULT_TEMPLATES: Record<string, { email?: { subject: string; body: string }; sms?: { body: string } }> = {

  // ══════════════════════════════════════════════════════════════════════════
  // 1. BOOKING CREATED
  // ══════════════════════════════════════════════════════════════════════════

  // Admin creates booking → Payment Request email to customer
  PaymentRequest: {
    email: {
      subject: 'Payment Required — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#1a1a1a">Payment Required 💳</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your booking has been created. Please review the details and complete payment to confirm.</p>
<table style="${TABLE}">${bookingSummaryRows()}</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{pay_url}}" style="${BTN('#2563eb')}">Review &amp; Pay →</a>
</p>
<p style="color:#888;font-size:12px;text-align:center">This link is valid for 24 hours.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Payment required for booking {{booking_reference}} ({{currency}} {{total_amount}}). Pay here: {{pay_url}}' },
  },

  // Customer creates booking → Booking Received email to customer
  BookingReceived: {
    email: {
      subject: 'Booking Received — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#1a1a1a">Booking Received ✅</h2>
<p>Hi {{customer_first_name}},</p>
<p>We have received your booking. Our team will review and confirm shortly. Your card will be charged <strong>{{currency}} {{total_amount}}</strong> upon confirmation.</p>
<table style="${TABLE}">${bookingSummaryRows()}</table>
<p style="color:#666;font-size:13px">You will receive a confirmation email once reviewed. Contact {{company_name}} with any questions.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} received. We will confirm shortly. Total: {{currency}} {{total_amount}}.' },
  },

  // Customer creates booking → New Booking email to admin (with Confirm & Charge / Reject buttons)
  AdminNewBooking: {
    email: {
      subject: '🆕 New Booking — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>New Booking — Action Required 🆕</h2>
<p>A new booking has been submitted. The customer has saved their payment method.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Reference</td><td style="${TD_R}"><strong>{{booking_reference}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Customer</td><td style="${TD_R}"><strong>{{customer_name}}</strong></td></tr>
  ${bookingSummaryRows()}
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{admin_booking_url}}" style="${BTN('#16a34a')}">✅ Confirm &amp; Charge</a>
  <a href="{{admin_booking_url}}" style="${BTN('#dc2626')}">✕ Reject Booking</a>
</p>
<p style="color:#888;font-size:12px;text-align:center">Log in to the admin portal to action this booking.</p>
</div>`,
    },
    sms: { body: 'New booking {{booking_reference}}: {{customer_name}} on {{pickup_time}}. Total {{currency}} {{total_amount}}. Login to confirm.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BOOKING CONFIRMED (Admin Confirm & Charge success)
  // ══════════════════════════════════════════════════════════════════════════

  BookingConfirmed: {
    email: {
      subject: 'Booking Confirmed — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#16a34a">Booking Confirmed ✅</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your booking <strong>{{booking_reference}}</strong> is confirmed and payment has been processed.</p>
<table style="${TABLE}">${bookingSummaryRows()}</table>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Amount Charged</td><td style="${TD_R}"><strong>{{currency}} {{total_amount}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Payment</td><td style="${TD_R}">{{card_brand}} ****{{card_last4}}</td></tr>
</table>
<p style="color:#666;font-size:13px">To modify or cancel, please contact {{company_name}}.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, booking {{booking_reference}} confirmed. {{pickup_time}} from {{pickup_address}}. Charged {{currency}} {{total_amount}}.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2a. BOOKING REJECTED
  // ══════════════════════════════════════════════════════════════════════════

  BookingRejected: {
    email: {
      subject: 'Booking Rejected — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#dc2626">Booking Rejected</h2>
<p>Hi {{customer_first_name}},</p>
<p>Unfortunately we were unable to confirm your booking <strong>{{booking_reference}}</strong>.</p>
<p><strong>Reason:</strong> {{rejection_reason}}</p>
<p>No charge has been made to your payment method.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Date &amp; Time</td><td style="${TD_R}">{{pickup_time}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Route</td><td style="${TD_R}">{{pickup_address}} → {{dropoff_address}}</td></tr>
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{booking_url}}" style="${BTN('#2563eb')}">Book Again →</a>
</p>
<p style="color:#666;font-size:13px">Contact {{company_name}} if you need further assistance.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} could not be confirmed. No charge made. Please contact us to rebook.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2b. BOOKING MODIFIED
  // ══════════════════════════════════════════════════════════════════════════

  // Admin modifies → customer review & confirm
  BookingModified: {
    email: {
      subject: 'Booking Updated — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Booking Updated 📝</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your booking <strong>{{booking_reference}}</strong> has been updated by our team. Please review the new details below.</p>
<table style="${TABLE}">${bookingSummaryRows()}</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{admin_booking_url}}" style="${BTN('#2563eb')}">Review &amp; Confirm →</a>
</p>
<p style="color:#666;font-size:13px">Contact {{company_name}} if you have any questions.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Your booking {{booking_reference}} has been updated. Please check your email and confirm the new details.' },
  },

  // Customer requests modification → admin
  ModificationRequest: {
    email: {
      subject: 'Modification Request — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Modification Request 📝</h2>
<p>A customer has requested changes to booking <strong>{{booking_reference}}</strong>.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Customer</td><td style="${TD_R}"><strong>{{customer_name}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Reference</td><td style="${TD_R}"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="${TD_L}">Modification Note</td><td style="${TD_R}">{{modification_note}}</td></tr>
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{admin_booking_url}}" style="${BTN('#2563eb')}">Review Booking →</a>
</p>
</div>`,
    },
    sms: { body: 'Modification request for booking {{booking_reference}} from {{customer_name}}. Login to review.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 3. DRIVER ON THE WAY
  // ══════════════════════════════════════════════════════════════════════════

  // Driver en route → SMS to passenger only
  DriverEnRoute: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your driver {{driver_name}} is on the way — ETA {{eta_minutes}} min. Vehicle: {{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}}).' },
  },

  // Driver arrived → SMS to passenger only
  DriverArrived: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your driver has arrived at {{pickup_address}}. {{vehicle_make}} {{vehicle_model}} — Plate: {{vehicle_plate}} — Colour: {{vehicle_colour}}.' },
  },

  // Trip started (internal trigger)
  TripStarted: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your trip {{booking_reference}} has started. Enjoy your ride!' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 4. JOB FULFILLED
  // ══════════════════════════════════════════════════════════════════════════

  JobCompleted: {
    email: {
      subject: 'Trip Complete — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Trip Complete 🏁</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your trip <strong>{{booking_reference}}</strong> is complete. Here is your final summary.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Date &amp; Time</td><td style="${TD_R}">{{pickup_time}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Pickup</td><td style="${TD_R}">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="${TD_L}">Via</td><td style="${TD_R}">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="${TD_L}">Dropoff</td><td style="${TD_R}">{{dropoff_address}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Driver</td><td style="${TD_R}">{{driver_name}}</td></tr>
  <tr><td style="${TD_L}">Vehicle</td><td style="${TD_R}">{{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}})</td></tr>
</table>
<hr style="${DIVIDER}">
<table style="${TABLE}">
  <tr><td style="${TD_L}">Base Fare</td><td style="${TD_R}">{{currency}} {{base_fare}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Toll / Parking</td><td style="${TD_R}">{{currency}} {{toll_parking_total}}</td></tr>
  <tr><td style="${TD_L}">Waiting Time</td><td style="${TD_R}">{{currency}} {{waiting_time_fee}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Extras</td><td style="${TD_R}">{{currency}} {{extras_amount}}</td></tr>
  <tr><td style="${TD_L}">Part A (Pre-auth)</td><td style="${TD_R}">{{currency}} {{prepay_amount}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Part B (Actual)</td><td style="${TD_R}">{{currency}} {{actual_amount}}</td></tr>
  <tr><td style="${TD_L}">Adjustment</td><td style="${TD_R}">{{currency}} {{adjustment_amount}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="${TD_L};font-weight:bold">Grand Total Paid</td><td style="${TD_R};font-weight:bold;font-size:16px">{{currency}} {{total_amount}}</td></tr>
</table>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Payment</td><td style="${TD_R}">{{card_brand}} ****{{card_last4}}</td></tr>
</table>
<p style="color:#666;font-size:13px;text-align:center">Thank you for choosing {{company_name}}!</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Trip {{booking_reference}} complete. Total paid {{currency}} {{total_amount}}. Thank you for choosing {{company_name}}!' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 5. PAYMENT FAILED
  // ══════════════════════════════════════════════════════════════════════════

  PaymentFailed: {
    email: {
      subject: 'Payment Failed — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#dc2626">Payment Failed ⚠️</h2>
<p>Hi {{customer_first_name}},</p>
<p>We were unable to process payment of <strong>{{currency}} {{amount}}</strong> for booking <strong>{{booking_reference}}</strong>.</p>
<p style="text-align:center;margin:28px 0">
  <a href="{{payment_url}}" style="${BTN('#2563eb')}">Update Payment Method →</a>
</p>
<p style="color:#666;font-size:13px">Contact {{company_name}} if you need assistance.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Payment failed for booking {{booking_reference}}. Please update your payment method or contact us urgently.' },
  },

  AdminPaymentFailed: {
    email: {
      subject: '⚠️ Payment Failed — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#dc2626">Customer Payment Failed ⚠️</h2>
<p>Payment for booking <strong>{{booking_reference}}</strong> could not be processed.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Customer</td><td style="${TD_R}"><strong>{{customer_name}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Amount</td><td style="${TD_R}"><strong>{{currency}} {{amount}}</strong></td></tr>
  <tr><td style="${TD_L}">Date &amp; Time</td><td style="${TD_R}">{{pickup_time}}</td></tr>
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{admin_booking_url}}" style="${BTN('#2563eb')}">Review Booking →</a>
</p>
<p>Please contact the customer to arrange payment.</p>
</div>`,
    },
    sms: { body: 'Payment failed for booking {{booking_reference}} ({{customer_name}}). Please follow up.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 6. ADJUSTMENT (Part B settlement)
  // ══════════════════════════════════════════════════════════════════════════

  // Additional charge (Part B > Part A)
  AdditionalCharge: {
    email: {
      subject: 'Additional Charge — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Additional Charge Processed 💳</h2>
<p>Hi {{customer_first_name}},</p>
<p>An additional charge has been applied to booking <strong>{{booking_reference}}</strong> based on the final trip total.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Part A (Pre-auth)</td><td style="${TD_R}">{{currency}} {{prepay_amount}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Part B (Actual)</td><td style="${TD_R}">{{currency}} {{actual_amount}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="${TD_L};font-weight:bold">Additional Charge</td><td style="${TD_R};font-weight:bold;color:#dc2626">{{currency}} {{adjustment_amount}}</td></tr>
</table>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Charged To</td><td style="${TD_R}">{{card_brand}} ****{{card_last4}}</td></tr>
</table>
<p style="color:#666;font-size:13px">Contact {{company_name}} if you have any questions.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Additional charge of {{currency}} {{adjustment_amount}} applied to booking {{booking_reference}}. Contact us if you have questions.' },
  },

  // Refund issued (Part B < Part A)
  RefundIssued: {
    email: {
      subject: 'Refund Issued — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Refund Issued 💰</h2>
<p>Hi {{customer_first_name}},</p>
<p>A refund has been processed for booking <strong>{{booking_reference}}</strong>.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Part A (Pre-auth)</td><td style="${TD_R}">{{currency}} {{prepay_amount}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Part B (Actual)</td><td style="${TD_R}">{{currency}} {{actual_amount}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="${TD_L};font-weight:bold">Refund Amount</td><td style="${TD_R};font-weight:bold;color:#16a34a">{{currency}} {{refund_amount}}</td></tr>
</table>
<p>Please allow 5–10 business days for the funds to appear in your account.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Refund of {{currency}} {{refund_amount}} issued for booking {{booking_reference}}. Allow 5-10 business days.' },
  },

  // Adjustment charge failed
  AdjustmentFailed: {
    email: {
      subject: '⚠️ Adjustment Failed — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#dc2626">Adjustment Charge Failed ⚠️</h2>
<p>The additional charge for booking <strong>{{booking_reference}}</strong> could not be processed.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Customer</td><td style="${TD_R}"><strong>{{customer_name}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Amount</td><td style="${TD_R}"><strong>{{currency}} {{adjustment_amount}}</strong></td></tr>
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{admin_booking_url}}" style="${BTN('#2563eb')}">Review Booking →</a>
</p>
<p>Please contact the customer to arrange manual payment.</p>
</div>`,
    },
    sms: { body: 'Adjustment charge FAILED for booking {{booking_reference}} ({{customer_name}}). Amount: {{currency}} {{adjustment_amount}}. Manual action required.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 7. INVOICE
  // ══════════════════════════════════════════════════════════════════════════

  InvoiceSent: {
    email: {
      subject: 'Invoice {{invoice_number}} — {{company_name}}',
      body: `<div style="${BASE}">
<h2>Invoice 📄</h2>
<p>Hi {{customer_first_name}},</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Invoice #</td><td style="${TD_R}"><strong>{{invoice_number}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Amount Due</td><td style="${TD_R}"><strong>{{currency}} {{total_amount}}</strong></td></tr>
  <tr><td style="${TD_L}">Due Date</td><td style="${TD_R};color:#dc2626"><strong>{{due_date}}</strong></td></tr>
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{pay_url}}" style="${BTN('#2563eb')}">Pay Now →</a>
</p>
<p style="color:#666;font-size:12px;text-align:center">A PDF invoice is attached to this email.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} for {{currency}} {{total_amount}} due {{due_date}}. Pay: {{pay_url}}' },
  },

  InvoiceOverdue: {
    email: {
      subject: 'Invoice Overdue — {{invoice_number}}',
      body: `<div style="${BASE}">
<h2 style="color:#dc2626">Invoice Overdue ⚠️</h2>
<p>Hi {{customer_first_name}},</p>
<p>Invoice <strong>{{invoice_number}}</strong> was due on <strong>{{due_date}}</strong> and remains unpaid.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Invoice #</td><td style="${TD_R}"><strong>{{invoice_number}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Amount Overdue</td><td style="${TD_R};color:#dc2626"><strong>{{currency}} {{total_amount}}</strong></td></tr>
  <tr><td style="${TD_L}">Original Due Date</td><td style="${TD_R}">{{due_date}}</td></tr>
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{pay_url}}" style="${BTN('#dc2626')}">Pay Now →</a>
</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} {{currency}} {{total_amount}} is OVERDUE (due {{due_date}}). Pay now: {{pay_url}}' },
  },

  AdminInvoicePaid: {
    email: {
      subject: 'Invoice Paid — {{invoice_number}}',
      body: `<div style="${BASE}">
<h2 style="color:#16a34a">Invoice Paid ✅</h2>
<p>Invoice <strong>{{invoice_number}}</strong> has been paid by <strong>{{customer_name}}</strong>.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Invoice #</td><td style="${TD_R}"><strong>{{invoice_number}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Amount Received</td><td style="${TD_R}"><strong>{{currency}} {{total_amount}}</strong></td></tr>
</table>
</div>`,
    },
    sms: { body: 'Invoice {{invoice_number}} paid: {{currency}} {{total_amount}} from {{customer_name}}.' },
  },

  PaymentReceived: {
    email: {
      subject: 'Payment Received — {{invoice_number}}',
      body: `<div style="${BASE}"><h2 style="color:#16a34a">Payment Received ✅</h2><p>Hi {{customer_first_name}},</p><p>Payment of <strong>{{currency}} {{total_amount}}</strong> for invoice <strong>{{invoice_number}}</strong> has been received. Thank you!</p></div>`,
    },
    sms: { body: '{{company_name}}: Payment {{currency}} {{total_amount}} received (Invoice {{invoice_number}}). Thank you!' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 8. AUTH
  // ══════════════════════════════════════════════════════════════════════════

  CustomerRegistered: {
    email: {
      subject: 'Welcome to {{company_name}}',
      body: `<div style="${BASE}">
<h2>Welcome to {{company_name}}! 🎉</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your account has been created successfully. You can now book your rides online.</p>
<p style="text-align:center;margin:28px 0">
  <a href="{{booking_url}}" style="${BTN('#2563eb')}">Book a Ride →</a>
</p>
<p style="color:#666;font-size:13px">Need help? Contact {{company_name}} at any time.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Welcome {{customer_first_name}}! Your account is ready. Book your ride anytime.' },
  },

  CustomerForgotPassword: {
    email: {
      subject: 'Reset Your Password — {{company_name}}',
      body: `<div style="${BASE}">
<h2>Reset Your Password 🔐</h2>
<p>Hi {{customer_first_name}},</p>
<p>Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
<p style="text-align:center;margin:28px 0">
  <a href="{{reset_url}}" style="${BTN('#2563eb')}">Reset Password →</a>
</p>
<p style="color:#666;font-size:13px">If you did not request this, please ignore this email. Your account is safe.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Password reset link sent to your email. Valid for 1 hour.' },
  },

  CustomerOtpSent: {
    sms: { body: '{{company_name}}: Your verification code is {{otp_code}}. Valid for 10 minutes. Do not share this code.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DRIVER EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  DriverInvitationSent: {
    email: {
      subject: 'New Job — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>New Job Assignment 🚗</h2>
<p>{{driver_name}}, you have been assigned a new job. Please confirm via the app.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Booking</td><td style="${TD_R}"><strong>{{booking_reference}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Date &amp; Time</td><td style="${TD_R}"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="${TD_L}">Pickup</td><td style="${TD_R}"><strong>{{pickup_address}}</strong></td></tr>
  {{#if waypoint_count}}<tr style="${TR_ALT}"><td style="${TD_L}">Via</td><td style="${TD_R}">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="${TD_L}">Dropoff</td><td style="${TD_R}">{{dropoff_address}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Passenger</td><td style="${TD_R}"><strong>{{passenger_name}}</strong> — {{passenger_phone}}</td></tr>
  <tr><td style="${TD_L}">Pax / Luggage</td><td style="${TD_R}">{{passenger_count}} pax / {{luggage_count}} bags</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Special Requests</td><td style="${TD_R}">{{special_requests}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="${TD_L};font-weight:bold">Your Pay</td><td style="${TD_R};font-weight:bold;color:#16a34a;font-size:16px">{{currency}} {{driver_total}}</td></tr>
</table>
</div>`,
    },
    sms: { body: '{{company_name}}: New job {{booking_reference}}. {{pickup_time}} — Pick up {{passenger_name}} from {{pickup_address}}. Pay: {{currency}} {{driver_total}}. Confirm in app.' },
  },

  DriverAcceptedAssignment: {
    // Internal only — no notification sent
  },

  DriverRejectedAssignment: {
    email: {
      subject: '⚠️ Driver Rejected Job — {{booking_reference}}',
      body: `<div style="${BASE}"><h2 style="color:#dc2626">Driver Rejected Job ⚠️</h2><p>Driver <strong>{{driver_name}}</strong> has rejected booking <strong>{{booking_reference}}</strong>. Please log in to reassign a driver immediately.</p><p style="text-align:center;margin:28px 0"><a href="{{admin_booking_url}}" style="${BTN('#dc2626')}">Reassign Driver →</a></p></div>`,
    },
    sms: { body: 'ALERT: Driver {{driver_name}} rejected job {{booking_reference}}. Please reassign immediately.' },
  },

  DriverJobCancelled: {
    email: {
      subject: 'Job Cancelled — {{booking_reference}}',
      body: `<div style="${BASE}"><h2>Job Cancelled</h2><p>{{driver_name}}, job <strong>{{booking_reference}}</strong> has been cancelled. Reason: {{cancellation_reason}}</p></div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} cancelled. {{cancellation_reason}}' },
  },

  DriverPayUpdated: {
    email: {
      subject: 'Pay Updated — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Job Pay Updated 💰</h2>
<p>{{driver_name}}, pay for <strong>{{booking_reference}}</strong> has been updated. Please re-confirm in the app.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Base Pay</td><td style="${TD_R}">{{currency}} {{driver_pay_amount}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Toll / Parking</td><td style="${TD_R}">{{currency}} {{driver_toll_parking}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="${TD_L};font-weight:bold">Your Total</td><td style="${TD_R};font-weight:bold;color:#16a34a">{{currency}} {{driver_total}}</td></tr>
</table>
</div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} pay updated to {{currency}} {{driver_total}}. Please re-confirm in app.' },
  },

  DriverDocumentExpirySoon: {
    email: {
      subject: 'Document Expiry Reminder — {{document_type}}',
      body: `<div style="${BASE}"><h2 style="color:#d97706">Document Expiring Soon ⚠️</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> expires on <strong>{{expiry_date}}</strong>. Please renew before it expires to avoid account suspension.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} expires {{expiry_date}}. Please renew now to avoid suspension.' },
  },

  DriverDocumentExpired: {
    email: {
      subject: 'Document Expired — {{document_type}}',
      body: `<div style="${BASE}"><h2 style="color:#dc2626">Document Expired ❌</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> has expired. Your account has been suspended. Please upload the updated document immediately.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} expired. Account suspended. Upload updated document immediately.' },
  },

  DriverAccountSuspended: {
    email: {
      subject: 'Account Suspended',
      body: `<div style="${BASE}"><h2 style="color:#dc2626">Account Suspended</h2><p>{{driver_name}}, your account has been suspended due to expired documents. Please upload updated documents for review.</p></div>`,
    },
    sms: { body: '{{company_name}}: Account suspended. Please upload updated documents to reactivate.' },
  },

  DriverDocumentApproved: {
    email: {
      subject: 'Document Approved — {{document_type}}',
      body: `<div style="${BASE}"><h2 style="color:#16a34a">Document Approved ✅</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> has been approved! Your account is active.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} approved! Account is active.' },
  },

  DriverDocumentRejected: {
    email: {
      subject: 'Document Rejected — {{document_type}}',
      body: `<div style="${BASE}"><h2 style="color:#dc2626">Document Rejected ❌</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> was rejected. Reason: {{rejection_reason}}</p><p>Please re-upload the correct document.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} rejected. Reason: {{rejection_reason}}. Please re-upload.' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN / PLATFORM
  // ══════════════════════════════════════════════════════════════════════════

  AdminBookingPendingConfirm: {
    email: {
      subject: '⏳ Booking Pending Confirmation — {{booking_reference}}',
      body: `<div style="${BASE}">
<h2>Booking Pending Confirmation ⏳</h2>
<p>Booking <strong>{{booking_reference}}</strong> from <strong>{{customer_name}}</strong> is awaiting your action.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Reference</td><td style="${TD_R}"><strong>{{booking_reference}}</strong></td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Customer</td><td style="${TD_R}"><strong>{{customer_name}}</strong></td></tr>
  ${bookingSummaryRows()}
</table>
<p style="text-align:center;margin:28px 0">
  <a href="{{admin_booking_url}}" style="${BTN('#16a34a')}">✅ Confirm &amp; Charge</a>
  <a href="{{admin_booking_url}}" style="${BTN('#dc2626')}">✕ Reject</a>
</p>
</div>`,
    },
    sms: { body: 'Booking {{booking_reference}} pending confirmation. {{customer_name}} on {{pickup_time}}. Login to action.' },
  },

  // Cancellation (by customer or admin)
  BookingCancelled: {
    email: {
      subject: 'Booking Cancelled {{cancelled_by_label}}— {{booking_reference}}',
      body: `<div style="${BASE}">
<h2 style="color:#dc2626">Booking Cancelled</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your booking <strong>{{booking_reference}}</strong> has been cancelled{{cancellation_reason_line}}.</p>
<table style="${TABLE}">
  <tr><td style="${TD_L}">Date &amp; Time</td><td style="${TD_R}">{{pickup_time}}</td></tr>
  <tr style="${TR_ALT}"><td style="${TD_L}">Route</td><td style="${TD_R}">{{pickup_address}} → {{dropoff_address}}</td></tr>
</table>
<p>No charge has been made. Contact {{company_name}} if you need to rebook.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, booking {{booking_reference}} has been cancelled. Contact us if you need help.' },
  },

  AdminDriverRejected: {
    email: {
      subject: '⚠️ Driver Rejected Job — {{booking_reference}}',
      body: `<div style="${BASE}"><h2 style="color:#dc2626">Driver Rejected Job ⚠️</h2><p>Driver <strong>{{driver_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Please log in to reassign.</p><p style="text-align:center;margin:28px 0"><a href="{{admin_booking_url}}" style="${BTN('#dc2626')}">Reassign Driver →</a></p></div>`,
    },
    sms: { body: 'Driver {{driver_name}} rejected {{booking_reference}}. Please reassign.' },
  },

  AdminPartnerRejected: {
    email: {
      subject: '⚠️ Partner Rejected Job — {{booking_reference}}',
      body: `<div style="${BASE}"><h2 style="color:#dc2626">Partner Rejected ⚠️</h2><p><strong>{{partner_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Reason: {{rejection_reason}}</p></div>`,
    },
    sms: { body: '{{partner_name}} rejected {{booking_reference}}. Please reassign.' },
  },

  AdminTransferReceived: {
    email: {
      subject: 'Transfer Request — {{booking_reference}}',
      body: `<div style="${BASE}"><h2>Transfer Request</h2><p><strong>{{from_tenant_name}}</strong> transferred booking <strong>{{booking_reference}}</strong> to you ({{pickup_time}}, Price: {{currency}} {{transfer_price}}). Log in to accept or reject.</p></div>`,
    },
    sms: { body: '{{from_tenant_name}} transferred booking {{booking_reference}} to you. Price {{currency}} {{transfer_price}}. Login to process.' },
  },

  AdminPartnerAccepted: {
    email: {
      subject: 'Partner Accepted Job — {{booking_reference}}',
      body: `<div style="${BASE}"><h2 style="color:#16a34a">Partner Accepted ✅</h2><p><strong>{{partner_name}}</strong> accepted booking <strong>{{booking_reference}}</strong>.</p></div>`,
    },
    sms: { body: '{{partner_name}} accepted {{booking_reference}}.' },
  },

  AdminConnectionRequest: {
    email: {
      subject: 'New Partnership Request — {{from_tenant_name}}',
      body: `<div style="${BASE}"><h2>Partnership Invitation</h2><p><strong>{{from_tenant_name}}</strong> has sent you a partnership invitation. Log in to accept or decline.</p></div>`,
    },
    sms: { body: '{{from_tenant_name}} sent you a partnership invitation. Login to process.' },
  },

  AdminConnectionApproved: {
    email: {
      subject: 'Partnership Approved',
      body: `<div style="${BASE}"><h2 style="color:#16a34a">Partnership Established ✅</h2><p>Your partnership with <strong>{{partner_name}}</strong> has been approved.</p></div>`,
    },
    sms: { body: 'Partnership with {{partner_name}} approved!' },
  },

  AdminDriverVerificationResult: {
    email: {
      subject: 'Driver Verification Result — {{driver_name}}',
      body: `<div style="${BASE}"><h2>Driver Verification</h2><p>Driver <strong>{{driver_name}}</strong> — Result: <strong>{{verification_status}}</strong>.</p></div>`,
    },
    sms: { body: 'Driver {{driver_name}} verification: {{verification_status}}.' },
  },

  AdminSettlement: {
    email: {
      subject: 'Settlement Summary',
      body: `<div style="${BASE}"><h2>Settlement Processed</h2><p>Settlement of <strong>{{currency}} {{total_amount}}</strong> has been processed.</p></div>`,
    },
    sms: { body: 'Settlement processed: {{currency}} {{total_amount}}.' },
  },

  PlatformNewDriverReview: {
    email: {
      subject: 'New Driver Review — {{driver_name}}',
      body: `<div style="${BASE}"><h2>New Driver Review</h2><p>Driver <strong>{{driver_name}}</strong> ({{tenant_name}}) has applied for certification. Please review.</p></div>`,
    },
    sms: { body: 'New driver review: {{driver_name}} ({{tenant_name}}).' },
  },

  PlatformNewConnectionReview: {
    email: {
      subject: 'New Partnership Review',
      body: `<div style="${BASE}"><h2>Partnership Review</h2><p><strong>{{tenant_name}}</strong> and <strong>{{partner_name}}</strong> have applied to partner. Please review.</p></div>`,
    },
    sms: { body: 'New partnership review: {{tenant_name}} + {{partner_name}}.' },
  },

  PlatformNewTenant: {
    email: {
      subject: 'New Tenant — {{tenant_name}}',
      body: `<div style="${BASE}"><h2>New Tenant Registered</h2><p><strong>{{tenant_name}}</strong> has registered. Please review and activate.</p></div>`,
    },
    sms: { body: 'New tenant: {{tenant_name}}. Please review.' },
  },

  // Legacy aliases
  BookingCancelledByCustomer: {
    email: { subject: 'Booking Cancelled — {{booking_reference}}', body: `<div style="${BASE}"><h2 style="color:#dc2626">Booking Cancelled</h2><p>Hi {{customer_first_name}},</p><p>Booking <strong>{{booking_reference}}</strong> has been cancelled as requested. No charge has been made.</p></div>` },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} cancelled. Contact us if you need help.' },
  },

  BookingCancelledByAdmin: {
    email: { subject: 'Booking Cancelled — {{booking_reference}}', body: `<div style="${BASE}"><h2 style="color:#dc2626">Booking Cancelled</h2><p>Hi {{customer_first_name}},</p><p>Booking <strong>{{booking_reference}}</strong> has been cancelled. Reason: {{cancellation_reason}}</p></div>` },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} cancelled. {{cancellation_reason}}.' },
  },

  JobStarted: {
    sms: { body: '{{company_name}}: Your trip {{booking_reference}} has started. Enjoy your ride!' },
  },

  DriverAssigned: {
    sms: { body: '{{company_name}}: Driver {{driver_name}} assigned to booking {{booking_reference}}.' },
  },

  PaymentSuccess: {
    email: { subject: 'Payment Confirmed — {{booking_reference}}', body: `<div style="${BASE}"><h2 style="color:#16a34a">Payment Confirmed ✅</h2><p>Hi {{customer_first_name}},</p><p>Payment of <strong>{{currency}} {{total_amount}}</strong> for booking <strong>{{booking_reference}}</strong> confirmed.</p></div>` },
    sms: { body: '{{company_name}}: Payment {{currency}} {{total_amount}} confirmed for booking {{booking_reference}}.' },
  },
};
