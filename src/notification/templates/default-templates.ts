export const PLATFORM_DEFAULT_TEMPLATES: Record<string, { email?: { subject: string; body: string }; sms?: { body: string } }> = {

  // ─── CUSTOMER AUTH ──────────────────────────────────────────────────────────

  CustomerRegistered: {
    email: {
      subject: 'Welcome to {{company_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Welcome, {{customer_first_name}}!</h2><p>Your account has been created. <a href="{{booking_url}}">Book a ride now</a>.</p><p style="color:#666;font-size:13px">Questions? Contact {{company_name}}.</p></div>`,
    },
    sms: { body: '{{company_name}}: Welcome {{customer_first_name}}! Your account is ready.' },
  },

  CustomerForgotPassword: {
    email: {
      subject: 'Reset your password — {{company_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Reset Password</h2><p>Hi {{customer_first_name}},</p><p>Click below to reset your password (valid 1 hour):</p><p><a href="{{reset_url}}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Reset Password</a></p><p style="color:#666;font-size:13px">If you didn't request this, ignore this email.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your password reset link has been sent to your email.' },
  },

  CustomerOtpSent: {
    sms: { body: '{{company_name}}: Your OTP is {{otp_code}}. Valid for 10 minutes. Do not share.' },
  },

  // ─── BOOKING EVENTS (CUSTOMER) ──────────────────────────────────────────────

  // Triggered: guest checkout OR admin confirms booking
  // Sent to: Customer (email) + Passenger (SMS)
  BookingConfirmed: {
    email: {
      subject: 'Booking Confirmed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#1a1a1a">Your Booking is Confirmed ✅</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your booking <strong>{{booking_reference}}</strong> has been confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px">
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666;width:40%">Date &amp; Time</td><td style="padding:10px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px"><strong>{{pickup_address}}</strong></td></tr>
  {{#if waypoint_count}}<tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Via</td><td style="padding:10px"><strong>{{waypoints}}</strong></td></tr>{{/if}}
  <tr><td style="padding:10px;color:#666">Dropoff</td><td style="padding:10px"><strong>{{dropoff_address}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Vehicle</td><td style="padding:10px"><strong>{{car_type_name}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Passengers</td><td style="padding:10px"><strong>{{passenger_count}}</strong></td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border-radius:8px">
  <tr><td style="padding:10px;color:#666">Base Fare</td><td style="padding:10px;text-align:right">{{currency}} {{base_fare}}</td></tr>
  <tr><td style="padding:10px;color:#666">Toll / Parking</td><td style="padding:10px;text-align:right">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="padding:10px;font-weight:bold;font-size:16px">Total</td><td style="padding:10px;text-align:right;font-weight:bold;font-size:16px">{{currency}} {{total_amount}}</td></tr>
</table>
<p style="color:#666;font-size:13px">To modify or cancel, please contact {{company_name}}.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your booking {{booking_reference}} is confirmed. {{pickup_time}} from {{pickup_address}}. Total {{currency}} {{total_amount}}.' },
  },

  // Triggered: customer cancels / admin cancels / admin rejects
  // Sent to: Passenger (SMS + email) + Admin (email)
  BookingCancelled: {
    email: {
      subject: 'Booking Cancelled {{cancelled_by_label}}— {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#dc2626">Booking Cancelled</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your booking <strong>{{booking_reference}}</strong> has been cancelled{{cancellation_reason_line}}.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eee">
  <tr><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px"><strong>{{pickup_address}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Date &amp; Time</td><td style="padding:10px"><strong>{{pickup_time}}</strong></td></tr>
</table>
<p>If you have any questions please contact {{company_name}}.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, booking {{booking_reference}} has been cancelled. Contact us if you need help.' },
  },

  // Triggered: driver arrives at pickup location
  // Sent to: Passenger (SMS only)
  DriverArrived: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your driver {{driver_name}} has arrived at {{pickup_address}}. {{vehicle_make}} {{vehicle_model}} — Plate: {{vehicle_plate}}.' },
  },

  // Triggered: driver marks trip started / en route
  // Sent to: Passenger (SMS only)
  TripStarted: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your chauffeur is on the way for booking {{booking_reference}}. Please be ready at {{pickup_address}}.' },
  },

  // Triggered: booking status → COMPLETED / FULFILLED
  // Sent to: Customer (email + SMS)
  JobCompleted: {
    email: {
      subject: 'Trip Completed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#1a1a1a">Thank You for Riding with Us 🏁</h2>
<p>Hi {{customer_first_name}},</p>
<p>Your trip <strong>{{booking_reference}}</strong> is complete.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee">
  <tr><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Via</td><td style="padding:10px">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="padding:10px;color:#666">Dropoff</td><td style="padding:10px">{{dropoff_address}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Driver</td><td style="padding:10px">{{driver_name}}</td></tr>
  <tr><td style="padding:10px;color:#666">Base Fare</td><td style="padding:10px;text-align:right">{{currency}} {{base_fare}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Toll / Parking</td><td style="padding:10px;text-align:right">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="padding:10px;font-weight:bold">Total</td><td style="padding:10px;text-align:right;font-weight:bold">{{currency}} {{total_amount}}</td></tr>
</table>
<p style="color:#666;font-size:13px">Thank you for choosing {{company_name}}!</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Trip {{booking_reference}} complete. Total {{currency}} {{total_amount}}. Thank you for choosing {{company_name}}!' },
  },

  // ─── PAYMENT EVENTS ─────────────────────────────────────────────────────────

  PaymentSuccess: {
    email: {
      subject: 'Payment Received — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Payment Confirmed ✅</h2><p>Hi {{customer_first_name}},</p><p>Payment of <strong>{{currency}} {{total_amount}}</strong> for booking <strong>{{booking_reference}}</strong> has been received. Thank you.</p></div>`,
    },
    sms: { body: '{{company_name}}: Payment of {{currency}} {{total_amount}} received for booking {{booking_reference}}. Thank you.' },
  },

  PaymentFailed: {
    email: {
      subject: 'Payment Failed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Payment Failed ⚠️</h2><p>Hi {{customer_first_name}},</p><p>We were unable to process payment for booking <strong>{{booking_reference}}</strong>. Please contact us or update your payment details.</p></div>`,
    },
    sms: { body: '{{company_name}}: Payment failed for booking {{booking_reference}}. Please contact us urgently.' },
  },

  RefundIssued: {
    email: {
      subject: 'Refund Issued — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Refund Processed 💰</h2><p>Hi {{customer_first_name}},</p><p>A refund of <strong>{{currency}} {{total_amount}}</strong> has been issued for booking <strong>{{booking_reference}}</strong>. Please allow 3–5 business days for the funds to appear.</p></div>`,
    },
    sms: { body: '{{company_name}}: Refund of {{currency}} {{total_amount}} issued for booking {{booking_reference}}. Allow 3-5 business days.' },
  },

  // ─── INVOICE EVENTS ─────────────────────────────────────────────────────────

  InvoiceSent: {
    email: {
      subject: 'Invoice {{invoice_number}} — {{company_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>Invoice</h2>
<p>Hi {{customer_first_name}},</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee">
  <tr><td style="padding:10px;color:#666">Invoice #</td><td style="padding:10px"><strong>{{invoice_number}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Subtotal</td><td style="padding:10px">{{currency}} {{subtotal}}</td></tr>
  <tr><td style="padding:10px;color:#666">Toll / Parking</td><td style="padding:10px">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="padding:10px;font-weight:bold">Total Due</td><td style="padding:10px;font-weight:bold">{{currency}} {{total_amount}}</td></tr>
  <tr style="background:#fff3cd"><td style="padding:10px;color:#666">Due Date</td><td style="padding:10px;color:#dc2626"><strong>{{due_date}}</strong></td></tr>
</table>
</div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} for {{currency}} {{total_amount}} sent. Due {{due_date}}.' },
  },

  InvoiceOverdue: {
    email: {
      subject: 'Invoice Overdue — {{invoice_number}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Invoice Overdue ⚠️</h2><p>Hi {{customer_first_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> of <strong>{{currency}} {{total_amount}}</strong> was due on {{due_date}} and remains unpaid. Please settle immediately.</p></div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} {{currency}} {{total_amount}} is overdue. Please pay now.' },
  },

  PaymentReceived: {
    email: {
      subject: 'Payment Received — {{invoice_number}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Payment Received ✅</h2><p>Hi {{customer_first_name}},</p><p>Payment of <strong>{{currency}} {{total_amount}}</strong> for invoice <strong>{{invoice_number}}</strong> received. Thank you!</p></div>`,
    },
    sms: { body: '{{company_name}}: Payment {{currency}} {{total_amount}} received (Invoice {{invoice_number}}). Thank you!' },
  },

  // ─── DRIVER EVENTS ─────────────────────────────────────────────────────────

  // Triggered: admin assigns driver to booking
  // Sent to: Driver ONLY (SMS + email) — customer does NOT receive this
  DriverJobAssigned: {
    email: {
      subject: 'New Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>You Have a New Job 🚗</h2>
<p>{{driver_name}}, you have a new job to confirm.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee">
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Booking</td><td style="padding:10px"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Date &amp; Time</td><td style="padding:10px"><strong>{{pickup_time}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px"><strong>{{pickup_address}}</strong></td></tr>
  {{#if waypoint_count}}<tr><td style="padding:10px;color:#666">Via</td><td style="padding:10px"><strong>{{waypoints}}</strong></td></tr>{{/if}}
  <tr><td style="padding:10px;color:#666">Dropoff</td><td style="padding:10px"><strong>{{dropoff_address}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Passenger</td><td style="padding:10px"><strong>{{passenger_name}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Passenger Phone</td><td style="padding:10px"><strong>{{passenger_phone}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Pax / Luggage</td><td style="padding:10px">{{passenger_count}} pax / {{luggage_count}} bags</td></tr>
  <tr><td style="padding:10px;color:#666">Special Requests</td><td style="padding:10px">{{special_requests}}</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f0fdf4;border:1px solid #bbf7d0">
  <tr><td style="padding:10px;color:#166534;font-weight:bold">Your Pay</td><td style="padding:10px;text-align:right;font-weight:bold;color:#166534;font-size:16px">{{currency}} {{driver_total}}</td></tr>
</table>
<p>Accept or decline in the driver app.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: New job {{booking_reference}}. {{pickup_time}} — pick up {{passenger_name}} from {{pickup_address}}. Pay {{currency}} {{driver_total}}. Confirm in app.' },
  },

  // Triggered: admin assigns driver (DriverInvitationSent event)
  // Sent to: Driver ONLY
  DriverInvitationSent: {
    sms: { body: '{{company_name}}: New job {{booking_reference}}. {{pickup_time}} — {{pickup_address}} → {{dropoff_address}}. Passenger: {{passenger_name}} ({{passenger_phone}}). Pay {{currency}} {{driver_total}}. Confirm in app.' },
  },

  // DriverAcceptedAssignment — no customer notification needed (internal only)
  DriverAcceptedAssignment: {
    // Internal only — admin can see in booking detail. No customer email/SMS.
  },

  // Triggered: driver rejects job
  // Sent to: Admin ONLY
  DriverRejectedAssignment: {
    email: {
      subject: 'Driver Rejected Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Driver Rejected Job ⚠️</h2><p>Driver <strong>{{driver_name}}</strong> has rejected booking <strong>{{booking_reference}}</strong>. Please log in to reassign a driver.</p></div>`,
    },
    sms: { body: 'ALERT: Driver {{driver_name}} rejected job {{booking_reference}}. Please reassign immediately.' },
  },

  DriverJobConfirmed: {
    sms: { body: '{{company_name}}: Job {{booking_reference}} confirmed. See you at {{pickup_time}}.' },
  },

  DriverJobRejectedConfirm: {
    sms: { body: '{{company_name}}: Job {{booking_reference}} has been reassigned.' },
  },

  DriverJobCancelled: {
    email: {
      subject: 'Job Cancelled — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Job Cancelled</h2><p>{{driver_name}}, job <strong>{{booking_reference}}</strong> has been cancelled. Reason: {{cancellation_reason}}</p></div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} cancelled. {{cancellation_reason}}' },
  },

  DriverPayUpdated: {
    email: {
      subject: 'Pay Updated — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>Job Pay Updated 💰</h2>
<p>{{driver_name}}, pay for <strong>{{booking_reference}}</strong> has been updated.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee">
  <tr><td style="padding:10px;color:#666">Base Pay</td><td style="padding:10px;text-align:right">{{currency}} {{driver_pay_amount}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Toll / Parking</td><td style="padding:10px;text-align:right">{{currency}} {{driver_toll_parking}}</td></tr>
  <tr style="border-top:2px solid #e5e7eb"><td style="padding:10px;font-weight:bold">Your Total</td><td style="padding:10px;text-align:right;font-weight:bold;color:#16a34a">{{currency}} {{driver_total}}</td></tr>
</table>
<p>Please re-confirm in the app.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} pay updated to {{currency}} {{driver_total}}. Please re-confirm in app.' },
  },

  DriverDocumentExpirySoon: {
    email: {
      subject: 'Document Expiry Reminder — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#d97706">Document Expiring Soon ⚠️</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> expires on <strong>{{expiry_date}}</strong>. Please renew before it expires to avoid suspension.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} expires {{expiry_date}}. Please renew soon.' },
  },

  DriverDocumentExpired: {
    email: {
      subject: 'Document Expired — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Document Expired ❌</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> has expired. Please upload the updated document immediately.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} has expired. Please upload updated document immediately.' },
  },

  DriverAccountSuspended: {
    email: {
      subject: 'Account Suspended',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Account Suspended</h2><p>{{driver_name}}, your account has been suspended due to expired <strong>{{document_type}}</strong>. Please upload the latest document for review.</p></div>`,
    },
    sms: { body: '{{company_name}}: Account suspended ({{document_type}} expired). Upload latest document to reactivate.' },
  },

  DriverDocumentApproved: {
    email: {
      subject: 'Document Approved — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Document Approved ✅</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> has been approved!</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} has been approved! You are good to go.' },
  },

  DriverDocumentRejected: {
    email: {
      subject: 'Document Rejected — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Document Rejected ❌</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> was rejected. Reason: {{rejection_reason}}</p><p>Please re-upload the correct document.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} rejected. Reason: {{rejection_reason}}. Please re-upload.' },
  },

  // ─── ADMIN EVENTS ──────────────────────────────────────────────────────────

  // Triggered: new booking created (widget / guest / admin)
  // Sent to: All tenant admins
  AdminNewBooking: {
    email: {
      subject: '🆕 New Booking — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>New Booking Received 🆕</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee">
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Reference</td><td style="padding:10px"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Customer</td><td style="padding:10px"><strong>{{customer_name}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Date &amp; Time</td><td style="padding:10px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Via</td><td style="padding:10px">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="padding:10px;color:#666">Dropoff</td><td style="padding:10px">{{dropoff_address}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Vehicle</td><td style="padding:10px">{{car_type_name}}</td></tr>
  <tr><td style="padding:10px;color:#666">Passengers</td><td style="padding:10px">{{passenger_count}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;font-weight:bold">Total</td><td style="padding:10px"><strong>{{currency}} {{total_amount}}</strong></td></tr>
</table>
<p>Please log in to the admin portal to dispatch a driver.</p>
</div>`,
    },
    sms: { body: 'New booking {{booking_reference}}: {{customer_name}} on {{pickup_time}} from {{pickup_address}}. Total {{currency}} {{total_amount}}. Please dispatch.' },
  },

  // Triggered: new booking pending confirmation (widget / guest checkout)
  // Sent to: All tenant admins + Customer
  AdminBookingPendingConfirm: {
    email: {
      subject: '⏳ New Booking Pending Confirmation — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>New Booking Requires Your Confirmation ⏳</h2>
<p>A new booking has been submitted. Please review and confirm.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eee">
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Reference</td><td style="padding:10px"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Customer</td><td style="padding:10px"><strong>{{customer_name}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Date &amp; Time</td><td style="padding:10px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px">{{pickup_address}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Dropoff</td><td style="padding:10px">{{dropoff_address}}</td></tr>
  <tr><td style="padding:10px;color:#666">Vehicle</td><td style="padding:10px">{{car_type_name}}</td></tr>
  <tr style="background:#f9f9f9;border-top:2px solid #e5e7eb"><td style="padding:10px;font-weight:bold">Total</td><td style="padding:10px"><strong>{{currency}} {{total_amount}}</strong></td></tr>
</table>
<p style="text-align:center;margin:24px 0">
  <a href="{{admin_booking_url}}" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">Confirm Booking →</a>
</p>
</div>`,
    },
    sms: { body: 'New booking {{booking_reference}} from {{customer_name}} on {{pickup_time}} awaiting confirmation. Login to confirm.' },
  },

  // Triggered: driver rejects job → admin only
  AdminDriverRejected: {
    email: {
      subject: '⚠️ Driver Rejected Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Driver Rejected Job ⚠️</h2><p>Driver <strong>{{driver_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Please log in to reassign a driver.</p></div>`,
    },
    sms: { body: 'ALERT: Driver {{driver_name}} rejected job {{booking_reference}}. Please reassign.' },
  },

  AdminPartnerRejected: {
    email: {
      subject: '⚠️ Partner Rejected Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Partner Rejected ⚠️</h2><p><strong>{{partner_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Reason: {{rejection_reason}}</p><p>Log in to reassign.</p></div>`,
    },
    sms: { body: '{{partner_name}} rejected booking {{booking_reference}}. {{rejection_reason}}. Please reassign.' },
  },

  AdminTransferReceived: {
    email: {
      subject: 'Transfer Request — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>Transfer Request Received</h2>
<p><strong>{{from_tenant_name}}</strong> transferred a booking to you.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee">
  <tr><td style="padding:10px;color:#666">Booking</td><td style="padding:10px"><strong>{{booking_reference}}</strong></td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Date &amp; Time</td><td style="padding:10px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:10px;color:#666">Pickup</td><td style="padding:10px">{{pickup_address}}</td></tr>
  <tr style="background:#f9f9f9"><td style="padding:10px;color:#666">Dropoff</td><td style="padding:10px">{{dropoff_address}}</td></tr>
  <tr><td style="padding:10px;color:#666">Transfer Price</td><td style="padding:10px"><strong>{{currency}} {{transfer_price}}</strong></td></tr>
</table>
<p>Log in to accept or reject.</p>
</div>`,
    },
    sms: { body: '{{from_tenant_name}} transferred booking {{booking_reference}} to you. {{pickup_time}}. Price {{currency}} {{transfer_price}}. Log in to process.' },
  },

  AdminPartnerAccepted: {
    email: {
      subject: 'Partner Accepted Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Partner Accepted ✅</h2><p><strong>{{partner_name}}</strong> accepted booking <strong>{{booking_reference}}</strong> and will arrange a driver.</p></div>`,
    },
    sms: { body: '{{partner_name}} accepted booking {{booking_reference}}.' },
  },

  AdminConnectionRequest: {
    email: {
      subject: 'New Partnership Request — {{from_tenant_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Partnership Invitation</h2><p><strong>{{from_tenant_name}}</strong> sent you a partnership invitation. Log in to accept or decline.</p></div>`,
    },
    sms: { body: '{{from_tenant_name}} sent you a partnership invitation. Log in to process.' },
  },

  AdminConnectionApproved: {
    email: {
      subject: 'Partnership Approved',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Partnership Established ✅</h2><p>Your partnership with <strong>{{partner_name}}</strong> has been approved. You can now transfer bookings between each other.</p></div>`,
    },
    sms: { body: 'Partnership with {{partner_name}} approved! You can now transfer bookings.' },
  },

  AdminDriverVerificationResult: {
    email: {
      subject: 'Driver Verification Result — {{driver_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Driver Verification Result</h2><p>Driver <strong>{{driver_name}}</strong> verification: <strong>{{verification_status}}</strong>.</p></div>`,
    },
    sms: { body: 'Driver {{driver_name}} verification: {{verification_status}}.' },
  },

  AdminInvoicePaid: {
    email: {
      subject: 'Payment Received — {{invoice_number}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Payment Received ✅</h2><p>Invoice <strong>{{invoice_number}}</strong> has been paid: <strong>{{currency}} {{total_amount}}</strong>.</p></div>`,
    },
    sms: { body: 'Invoice {{invoice_number}} paid: {{currency}} {{total_amount}}.' },
  },

  AdminPaymentFailed: {
    email: {
      subject: '⚠️ Payment Failed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Payment Failed ⚠️</h2><p>Payment for booking <strong>{{booking_reference}}</strong> (customer: {{customer_name}}) has failed. Please follow up with the customer.</p></div>`,
    },
    sms: { body: 'Payment failed for booking {{booking_reference}} ({{customer_name}}). Please follow up.' },
  },

  AdminSettlement: {
    email: {
      subject: 'Settlement Summary',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Settlement Summary</h2><p>Your settlement for the period has been processed. Total: <strong>{{currency}} {{total_amount}}</strong>.</p></div>`,
    },
    sms: { body: 'Settlement processed: {{currency}} {{total_amount}}.' },
  },

  // ─── PLATFORM EVENTS (Super Admin) ─────────────────────────────────────────

  PlatformNewDriverReview: {
    email: {
      subject: 'New Driver Review — {{driver_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>New Driver Review Request</h2><p>Driver <strong>{{driver_name}}</strong> ({{tenant_name}}) has applied for external certification. Please log in to review.</p></div>`,
    },
    sms: { body: 'New driver review: {{driver_name}} ({{tenant_name}}). Please review.' },
  },

  PlatformNewConnectionReview: {
    email: {
      subject: 'New Partnership Review',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Partnership Review Request</h2><p><strong>{{tenant_name}}</strong> and <strong>{{partner_name}}</strong> have applied to partner. Please review.</p></div>`,
    },
    sms: { body: 'New partnership review: {{tenant_name}} + {{partner_name}}. Please review.' },
  },

  PlatformNewTenant: {
    email: {
      subject: 'New Tenant — {{tenant_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>New Tenant Registered</h2><p><strong>{{tenant_name}}</strong> has registered. Please review and activate.</p></div>`,
    },
    sms: { body: 'New tenant: {{tenant_name}}. Please review.' },
  },

  // Legacy aliases kept for backward compat
  BookingCancelledByCustomer: {
    email: {
      subject: 'Booking Cancelled by You — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Booking Cancelled</h2><p>Hi {{customer_first_name}},</p><p>Your booking <strong>{{booking_reference}}</strong> has been cancelled as requested. If a refund is due, allow 3–5 business days.</p></div>`,
    },
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, booking {{booking_reference}} has been cancelled. Contact us if you need help.' },
  },

  BookingCancelledByAdmin: {
    email: {
      subject: 'Booking Cancelled by Admin — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Booking Cancellation Notice</h2><p>Hi {{customer_first_name}},</p><p>Booking <strong>{{booking_reference}}</strong> has been cancelled. Reason: {{cancellation_reason}}</p><p>Please contact {{company_name}} to rebook.</p></div>`,
    },
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, booking {{booking_reference}} cancelled. {{cancellation_reason}}. Contact us to rebook.' },
  },

  // DriverEnRoute kept for legacy
  DriverEnRoute: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your driver {{driver_name}} is en route — ETA {{eta_minutes}} min to {{pickup_address}}.' },
  },

  JobStarted: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your trip {{booking_reference}} has started. Enjoy your ride!' },
  },

  DriverAssigned: {
    sms: { body: '{{company_name}}: Dear {{passenger_name}}, your driver {{driver_name}} in {{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}}) will pick you up at {{pickup_time}}.' },
  },
};
