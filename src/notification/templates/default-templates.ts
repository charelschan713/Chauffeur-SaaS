export const PLATFORM_DEFAULT_TEMPLATES: Record<string, { email?: { subject: string; body: string }; sms?: { body: string } }> = {

  // ─── CUSTOMER EVENTS ───────────────────────────────────────────────────────

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

  BookingConfirmed: {
    email: {
      subject: 'Booking Confirmed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#1a1a1a">Your Booking is Confirmed</h2>
<p>Hi {{customer_first_name}},</p>
<p>Booking <strong>{{booking_reference}}</strong> is confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Date &amp; Time</td><td style="padding:8px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Pickup</td><td style="padding:8px"><strong>{{pickup_address}}</strong></td></tr>
  {{#if waypoint_count}}<tr><td style="padding:8px;color:#666">Via</td><td style="padding:8px"><strong>{{waypoints}}</strong></td></tr>{{/if}}
  <tr><td style="padding:8px;color:#666">Dropoff</td><td style="padding:8px"><strong>{{dropoff_address}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Car Type</td><td style="padding:8px"><strong>{{car_type_name}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Passengers</td><td style="padding:8px"><strong>{{passenger_count}}</strong></td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f9f9">
  <tr><td style="padding:8px;color:#666">Base Fare</td><td style="padding:8px;text-align:right">{{currency}} {{base_fare}}</td></tr>
  <tr><td style="padding:8px;color:#666">Toll / Parking</td><td style="padding:8px;text-align:right">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:1px solid #eee"><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;text-align:right;font-weight:bold">{{currency}} {{total_amount}}</td></tr>
</table>
<p>Payment: {{payment_method}}</p>
<p style="color:#666;font-size:13px">To modify, contact {{company_name}}.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} confirmed. {{pickup_time}} from {{pickup_address}}. Total {{currency}} {{total_amount}}.' },
  },

  DriverAssigned: {
    email: {
      subject: 'Your Driver is Confirmed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>Your Driver is Assigned</h2>
<p>Hi {{customer_first_name}},</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Driver</td><td style="padding:8px"><strong>{{driver_name}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Vehicle</td><td style="padding:8px"><strong>{{vehicle_make}} {{vehicle_model}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Plate</td><td style="padding:8px"><strong>{{vehicle_plate}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Colour</td><td style="padding:8px"><strong>{{vehicle_colour}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Pickup</td><td style="padding:8px"><strong>{{pickup_address}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Time</td><td style="padding:8px"><strong>{{pickup_time}}</strong></td></tr>
</table>
</div>`,
    },
    sms: { body: '{{company_name}}: Your driver {{driver_name}} in {{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}}) will pick you up at {{pickup_time}}.' },
  },

  DriverEnRoute: {
    email: {
      subject: 'Driver En Route — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Your Driver is on the Way</h2><p>Hi {{customer_first_name}},</p><p>{{driver_name}} is heading to you — ETA {{eta_minutes}} minutes.</p><p>Please wait at <strong>{{pickup_address}}</strong>.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your driver {{driver_name}} is en route, ETA {{eta_minutes}} min to {{pickup_address}}.' },
  },

  JobStarted: {
    sms: { body: '{{company_name}}: Your trip {{booking_reference}} has started. Enjoy your ride!' },
  },

  JobCompleted: {
    email: {
      subject: 'Trip Completed — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>Thank You for Riding with Us</h2>
<p>Hi {{customer_first_name}},</p>
<p>Trip <strong>{{booking_reference}}</strong> is complete.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Pickup</td><td style="padding:8px">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="padding:8px;color:#666">Via</td><td style="padding:8px">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="padding:8px;color:#666">Dropoff</td><td style="padding:8px">{{dropoff_address}}</td></tr>
  <tr><td style="padding:8px;color:#666">Driver</td><td style="padding:8px">{{driver_name}}</td></tr>
  <tr><td style="padding:8px;color:#666">Base Fare</td><td style="padding:8px;text-align:right">{{currency}} {{base_fare}}</td></tr>
  <tr><td style="padding:8px;color:#666">Toll / Parking</td><td style="padding:8px;text-align:right">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:1px solid #eee"><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;text-align:right;font-weight:bold">{{currency}} {{total_amount}}</td></tr>
</table>
<p style="color:#666;font-size:13px">Thank you for choosing {{company_name}}!</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Trip {{booking_reference}} complete. Total {{currency}} {{total_amount}}. Thank you!' },
  },

  BookingCancelledByCustomer: {
    email: {
      subject: 'Booking Cancelled — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Your Booking is Cancelled</h2><p>Hi {{customer_first_name}},</p><p>Booking <strong>{{booking_reference}}</strong> has been cancelled. Refund will be processed within 5–10 business days.</p></div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} cancelled. Contact us if you have questions.' },
  },

  BookingCancelledByAdmin: {
    email: {
      subject: 'Booking Cancellation Notice — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Booking Cancellation Notice</h2><p>Hi {{customer_first_name}},</p><p>Booking <strong>{{booking_reference}}</strong> has been cancelled.</p><p>Reason: {{cancellation_reason}}</p><p>Refund will be processed. Please contact {{company_name}} to rebook.</p></div>`,
    },
    sms: { body: '{{company_name}}: Booking {{booking_reference}} cancelled. {{cancellation_reason}}. Contact us to rebook.' },
  },

  InvoiceSent: {
    email: {
      subject: 'Invoice {{invoice_number}} — {{company_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>Invoice</h2>
<p>Hi {{customer_first_name}},</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Invoice #</td><td style="padding:8px"><strong>{{invoice_number}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Subtotal</td><td style="padding:8px">{{currency}} {{subtotal}}</td></tr>
  <tr><td style="padding:8px;color:#666">Toll / Parking</td><td style="padding:8px">{{currency}} {{toll_parking_total}}</td></tr>
  <tr style="border-top:1px solid #eee"><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-weight:bold">{{currency}} {{total_amount}}</td></tr>
  <tr><td style="padding:8px;color:#666">Due Date</td><td style="padding:8px;color:#dc2626"><strong>{{due_date}}</strong></td></tr>
</table>
</div>`,
    },
    sms: { body: '{{company_name}}: Invoice {{invoice_number}} {{currency}} {{total_amount}} sent to your email. Due {{due_date}}.' },
  },

  InvoiceOverdue: {
    email: {
      subject: 'Invoice Overdue — {{invoice_number}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Invoice Overdue</h2><p>Hi {{customer_first_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> of <strong>{{currency}} {{total_amount}}</strong> is overdue (due {{due_date}}). Please settle ASAP.</p></div>`,
    },
    sms: { body: '{{company_name}}: Reminder — invoice {{invoice_number}} {{currency}} {{total_amount}} is overdue. Please pay now.' },
  },

  PaymentReceived: {
    email: {
      subject: 'Payment Received — {{invoice_number}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Payment Received</h2><p>Hi {{customer_first_name}},</p><p>We received payment of <strong>{{currency}} {{total_amount}}</strong> for invoice <strong>{{invoice_number}}</strong>. Thank you!</p></div>`,
    },
    sms: { body: '{{company_name}}: Payment {{currency}} {{total_amount}} received (Invoice {{invoice_number}}). Thank you!' },
  },

  // ─── DRIVER EVENTS ─────────────────────────────────────────────────────────

  DriverJobAssigned: {
    email: {
      subject: 'New Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>You Have a New Job</h2>
<p>{{driver_name}}, you have a new job to confirm.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Booking</td><td style="padding:8px"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Date &amp; Time</td><td style="padding:8px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Pickup</td><td style="padding:8px"><strong>{{pickup_address}}</strong></td></tr>
  {{#if waypoint_count}}<tr><td style="padding:8px;color:#666">Via</td><td style="padding:8px"><strong>{{waypoints}}</strong></td></tr>{{/if}}
  <tr><td style="padding:8px;color:#666">Dropoff</td><td style="padding:8px"><strong>{{dropoff_address}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Passenger</td><td style="padding:8px"><strong>{{passenger_name}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Passenger Phone</td><td style="padding:8px"><strong>{{passenger_phone}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Pax / Luggage</td><td style="padding:8px">{{passenger_count}} / {{luggage_count}}</td></tr>
  <tr><td style="padding:8px;color:#666">Notes</td><td style="padding:8px">{{special_requests}}</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f0fdf4">
  <tr><td style="padding:8px;color:#666">Temperature</td><td style="padding:8px">{{temperature_c}}°C</td></tr>
  <tr><td style="padding:8px;color:#666">Music</td><td style="padding:8px">{{music_preference}}</td></tr>
  <tr><td style="padding:8px;color:#666">Conversation</td><td style="padding:8px">{{conversation_preference}}</td></tr>
  <tr><td style="padding:8px;color:#666">Seat</td><td style="padding:8px">{{seat_preference}}</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Base Pay</td><td style="padding:8px;text-align:right">{{currency}} {{driver_pay_amount}}</td></tr>
  <tr><td style="padding:8px;color:#666">Toll / Parking</td><td style="padding:8px;text-align:right">{{currency}} {{driver_toll_parking}}</td></tr>
  <tr style="border-top:1px solid #eee"><td style="padding:8px;font-weight:bold">Your Total</td><td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a">{{currency}} {{driver_total}}</td></tr>
</table>
<p>Accept or decline in the app.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: New job {{booking_reference}}. {{pickup_time}} pick up {{passenger_name}} from {{pickup_address}}. Pay {{currency}} {{driver_total}}. Confirm in app.' },
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
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Job Cancelled</h2><p>{{driver_name}}, job <strong>{{booking_reference}}</strong> has been cancelled.</p><p>Reason: {{cancellation_reason}}</p></div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} cancelled. {{cancellation_reason}}' },
  },

  DriverPayUpdated: {
    email: {
      subject: 'Pay Updated — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>Job Pay Updated</h2>
<p>{{driver_name}}, pay for <strong>{{booking_reference}}</strong> has been updated.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Base Pay</td><td style="padding:8px;text-align:right">{{currency}} {{driver_pay_amount}}</td></tr>
  <tr><td style="padding:8px;color:#666">Toll / Parking</td><td style="padding:8px;text-align:right">{{currency}} {{driver_toll_parking}}</td></tr>
  <tr style="border-top:1px solid #eee"><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a">{{currency}} {{driver_total}}</td></tr>
</table>
<p>Please re-confirm in the app.</p>
</div>`,
    },
    sms: { body: '{{company_name}}: Job {{booking_reference}} pay updated to {{currency}} {{driver_total}}. Please re-confirm.' },
  },

  DriverDocumentExpirySoon: {
    email: {
      subject: 'Document Expiry Reminder — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#d97706">Document Expiring Soon</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> expires on <strong>{{expiry_date}}</strong>. Please renew to avoid account suspension.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} expires {{expiry_date}}. Please renew soon.' },
  },

  DriverDocumentExpired: {
    email: {
      subject: 'Document Expired — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Document Expired</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> has expired. Please upload the updated document.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} has expired. Please upload updated document.' },
  },

  DriverAccountSuspended: {
    email: {
      subject: 'Account Suspended',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Account Suspended</h2><p>{{driver_name}}, your account has been suspended due to expired <strong>{{document_type}}</strong>. Upload the latest document for review.</p></div>`,
    },
    sms: { body: '{{company_name}}: Account suspended ({{document_type}} expired). Upload latest document.' },
  },

  DriverDocumentApproved: {
    email: {
      subject: 'Document Approved — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#16a34a">Document Approved</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> has been approved!</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} has been approved!' },
  },

  DriverDocumentRejected: {
    email: {
      subject: 'Document Rejected — {{document_type}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Document Rejected</h2><p>{{driver_name}}, your <strong>{{document_type}}</strong> was rejected.</p><p>Reason: {{rejection_reason}}</p><p>Please re-upload the correct document.</p></div>`,
    },
    sms: { body: '{{company_name}}: Your {{document_type}} rejected. Reason: {{rejection_reason}}. Please re-upload.' },
  },

  // ─── ADMIN EVENTS ──────────────────────────────────────────────────────────

  AdminNewBooking: {
    email: {
      subject: 'New Booking — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>New Booking Received</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Booking</td><td style="padding:8px"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Customer</td><td style="padding:8px"><strong>{{customer_name}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Date &amp; Time</td><td style="padding:8px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Pickup</td><td style="padding:8px">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="padding:8px;color:#666">Via</td><td style="padding:8px">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="padding:8px;color:#666">Dropoff</td><td style="padding:8px">{{dropoff_address}}</td></tr>
  <tr><td style="padding:8px;color:#666">Car Type</td><td style="padding:8px">{{car_type_name}}</td></tr>
  <tr><td style="padding:8px;color:#666">Total</td><td style="padding:8px"><strong>{{currency}} {{total_amount}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Payment</td><td style="padding:8px">{{payment_method}}</td></tr>
</table>
<p>Please log in to dispatch.</p>
</div>`,
    },
    sms: { body: 'New booking {{booking_reference}}: {{customer_name}} {{pickup_time}} {{pickup_address}}. Please dispatch.' },
  },

  AdminDriverRejected: {
    email: {
      subject: 'Driver Rejected Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Driver Rejected Job</h2><p>Driver <strong>{{driver_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Please log in to reassign.</p></div>`,
    },
    sms: { body: 'Driver {{driver_name}} rejected job {{booking_reference}}. Please reassign.' },
  },

  AdminPartnerRejected: {
    email: {
      subject: 'Partner Rejected Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Partner Rejected</h2><p><strong>{{partner_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>.</p><p>Reason: {{rejection_reason}}</p><p>Log in to reassign.</p></div>`,
    },
    sms: { body: '{{partner_name}} rejected booking {{booking_reference}}. {{rejection_reason}}. Please reassign.' },
  },

  AdminTransferReceived: {
    email: {
      subject: 'Transfer Request — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2>Transfer Request Received</h2>
<p><strong>{{from_tenant_name}}</strong> transferred a booking to you.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr><td style="padding:8px;color:#666">Booking</td><td style="padding:8px"><strong>{{booking_reference}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Date &amp; Time</td><td style="padding:8px"><strong>{{pickup_time}}</strong></td></tr>
  <tr><td style="padding:8px;color:#666">Pickup</td><td style="padding:8px">{{pickup_address}}</td></tr>
  {{#if waypoint_count}}<tr><td style="padding:8px;color:#666">Via</td><td style="padding:8px">{{waypoints}}</td></tr>{{/if}}
  <tr><td style="padding:8px;color:#666">Dropoff</td><td style="padding:8px">{{dropoff_address}}</td></tr>
  <tr><td style="padding:8px;color:#666">Vehicles</td><td style="padding:8px">{{platform_vehicle_names}}</td></tr>
  <tr><td style="padding:8px;color:#666">Transfer Price</td><td style="padding:8px"><strong>{{currency}} {{transfer_price}}</strong></td></tr>
</table>
<p>Log in to accept or reject.</p>
</div>`,
    },
    sms: { body: '{{from_tenant_name}} transferred booking {{booking_reference}} to you. {{pickup_time}} {{pickup_address}}. Price {{currency}} {{transfer_price}}. Log in to process.' },
  },

  AdminPartnerAccepted: {
    email: {
      subject: 'Partner Accepted Job — {{booking_reference}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#16a34a">Partner Accepted</h2><p><strong>{{partner_name}}</strong> accepted booking <strong>{{booking_reference}}</strong> and will arrange a driver.</p></div>`,
    },
    sms: { body: '{{partner_name}} accepted booking {{booking_reference}}.' },
  },

  AdminConnectionRequest: {
    email: {
      subject: 'New Partnership Request — {{from_tenant_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Partnership Invitation</h2><p><strong>{{from_tenant_name}}</strong> sent you a partnership invitation. Log in to accept or decline.</p></div>`,
    },
    sms: { body: '{{from_tenant_name}} sent you a partnership invitation. Log in to process.' },
  },

  AdminConnectionApproved: {
    email: {
      subject: 'Partnership Approved',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#16a34a">Partnership Established</h2><p>Your partnership with <strong>{{partner_name}}</strong> has been approved. You can now transfer bookings between each other.</p></div>`,
    },
    sms: { body: 'Partnership with {{partner_name}} approved! You can now transfer bookings.' },
  },

  AdminDriverVerificationResult: {
    email: {
      subject: 'Driver Verification Result — {{driver_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Driver Verification Result</h2><p>Driver <strong>{{driver_name}}</strong> verification: <strong>{{verification_status}}</strong>.</p></div>`,
    },
    sms: { body: 'Driver {{driver_name}} verification: {{verification_status}}.' },
  },

  AdminInvoicePaid: {
    email: {
      subject: 'Payment Received — {{invoice_number}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#16a34a">Payment Received</h2><p>Invoice <strong>{{invoice_number}}</strong> has been paid: <strong>{{currency}} {{total_amount}}</strong>.</p></div>`,
    },
    sms: { body: 'Invoice {{invoice_number}} paid: {{currency}} {{total_amount}}.' },
  },

  // ─── PLATFORM EVENTS (Super Admin) ─────────────────────────────────────────

  PlatformNewDriverReview: {
    email: {
      subject: 'New Driver Review — {{driver_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>New Driver Review Request</h2><p>Driver <strong>{{driver_name}}</strong> ({{tenant_name}}) has applied for external certification. Please log in to review.</p></div>`,
    },
    sms: { body: 'New driver review: {{driver_name}} ({{tenant_name}}). Please review.' },
  },

  PlatformNewConnectionReview: {
    email: {
      subject: 'New Partnership Review',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Partnership Review Request</h2><p><strong>{{tenant_name}}</strong> and <strong>{{partner_name}}</strong> have applied to partner. Please review.</p></div>`,
    },
    sms: { body: 'New partnership review: {{tenant_name}} + {{partner_name}}. Please review.' },
  },

  PlatformNewTenant: {
    email: {
      subject: 'New Tenant — {{tenant_name}}',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>New Tenant Registered</h2><p><strong>{{tenant_name}}</strong> has registered. Please review and activate.</p></div>`,
    },
    sms: { body: 'New tenant: {{tenant_name}}. Please review.' },
  },
};
