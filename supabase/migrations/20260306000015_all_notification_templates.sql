-- Full notification templates seed for aschauffeured (42 events)
-- Using direct INSERT ... ON CONFLICT for safety

INSERT INTO public.tenant_notification_templates(tenant_id,event_type,channel,subject,body) VALUES

-- #1 Customer Registration
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CustomerRegistered','email','Welcome to ASChauffeured, {{customer_name}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Welcome, {{customer_name}}</h2><p style="color:#d1d5db;">Your account has been created. We look forward to serving you with a premium chauffeur experience.</p><p style="color:#9ca3af;font-size:13px;margin-top:16px;">Login: <a href="https://aschauffeured.chauffeurssolution.com" style="color:#c8a96b;">your portal</a></p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia · aschauffeured.com.au</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CustomerRegistered','sms','',
'Welcome to ASChauffeured, {{customer_name}}! Your account is ready. Book at aschauffeured.com.au'),

-- #2 Forgot Password
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CustomerForgotPassword','email','Reset your ASChauffeured password',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Password Reset</h2><p style="color:#d1d5db;margin:0 0 20px;">Hi {{customer_name}}, click below to reset your password. Link expires in 1 hour.</p><a href="{{reset_link}}" style="background:#c8a96b;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Reset Password</a><p style="color:#6b7280;font-size:12px;margin-top:20px;">Ignore if you did not request this.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CustomerForgotPassword','sms','',
'ASChauffeured: Reset your password: {{reset_link}} (valid 1 hour). Ignore if not requested.'),

-- #3 OTP (SMS only)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CustomerOtp','sms','',
'ASChauffeured code: {{otp}}. Valid 10 minutes. Do not share.'),

-- #4 Booking Confirmed SMS (email in migration 14)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','BookingConfirmed','sms','',
'ASChauffeured CONFIRMED: {{booking_reference}} | {{pickup_address}} to {{dropoff_address}} | {{pickup_time}} | Total: {{total_price}}'),

-- #5 Driver Assigned SMS
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverAcceptedAssignment','sms','',
'ASChauffeured: Driver {{driver_name}} in {{vehicle_make}} {{vehicle_model}} assigned to {{booking_reference}}.'),

-- #6 Driver En Route SMS
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverInvitationSent','sms','',
'ASChauffeured: {{driver_name}} is on the way to you. Booking {{booking_reference}}. Please be ready.'),

-- #7 Trip Started (SMS only)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','TripStarted','sms','',
'ASChauffeured: Your trip {{booking_reference}} has started. Enjoy your ride!'),

-- #8 Trip Completed SMS
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','JobCompleted','sms','',
'ASChauffeured: Trip {{booking_reference}} complete. Total: {{total_price}}. Thank you!'),

-- #9 Booking Cancelled by Customer
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','BookingCancelled','sms','',
'ASChauffeured: Booking {{booking_reference}} cancelled. Contact info@aschauffeured.com.au for queries.'),

-- #10 Booking Cancelled by Admin
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','BookingCancelledByAdmin','email','Your booking has been cancelled — {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Booking Cancelled</h2><p style="color:#d1d5db;">Dear {{customer_name}}, booking <strong style="color:#c8a96b;">{{booking_reference}}</strong> has been cancelled. Refund will be processed if applicable. Sorry for any inconvenience.</p><p style="color:#9ca3af;font-size:13px;margin-top:16px;"><a href="mailto:info@aschauffeured.com.au" style="color:#c8a96b;">info@aschauffeured.com.au</a></p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','BookingCancelledByAdmin','sms','',
'ASChauffeured: Booking {{booking_reference}} cancelled by our team. Refund processed if applicable. Sorry.'),

-- #11 Extra Charge SMS
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','JobFulfilledWithExtras','sms','',
'ASChauffeured: Additional charge applied to {{booking_reference}}. Total: {{total_price}}. Contact us for details.'),

-- #12 Refund Issued
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','RefundIssued','email','Refund issued for {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Refund Processed</h2><p style="color:#d1d5db;">Dear {{customer_name}}, a refund of <strong style="color:#c8a96b;">{{refund_amount}}</strong> for {{booking_reference}} has been issued. Allow 5–10 business days.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','RefundIssued','sms','',
'ASChauffeured: Refund of {{refund_amount}} for {{booking_reference}} issued. Allow 5-10 business days.'),

-- #13 Invoice Sent
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','InvoiceSent','email','Invoice {{invoice_number}} from ASChauffeured',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Invoice {{invoice_number}}</h2><p style="color:#d1d5db;margin:0 0 8px;">Dear {{customer_name}},</p><p style="color:#e5e7eb;margin:0 0 4px;">Amount: <strong style="color:#c8a96b;">{{amount}}</strong></p><p style="color:#e5e7eb;margin:0 0 20px;">Due: <strong>{{due_date}}</strong></p><a href="{{invoice_url}}" style="background:#c8a96b;color:#000;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">View Invoice PDF</a><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','InvoiceSent','sms','',
'ASChauffeured Invoice {{invoice_number}}: {{amount}} due {{due_date}}. View: {{invoice_url}}'),

-- #14 Invoice Overdue
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','InvoiceOverdue','email','OVERDUE: Invoice {{invoice_number}} — ASChauffeured',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#ef4444;margin:0 0 12px;">Invoice Overdue</h2><p style="color:#d1d5db;">Dear {{customer_name}}, invoice <strong style="color:#c8a96b;">{{invoice_number}}</strong> for <strong>{{amount}}</strong> was due {{due_date}} and remains unpaid. Please settle promptly.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','InvoiceOverdue','sms','',
'OVERDUE: ASChauffeured Invoice {{invoice_number}} for {{amount}} due {{due_date}}. Pay immediately.'),

-- #15 Payment Success
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PaymentSuccess','email','Payment received — {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#22c55e;margin:0 0 12px;">Payment Confirmed</h2><p style="color:#d1d5db;">Dear {{customer_name}}, payment of <strong style="color:#c8a96b;">{{amount}}</strong> received for {{booking_reference}}. Card ending {{card_last4}}. Thank you!</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PaymentSuccess','sms','',
'ASChauffeured: Payment {{amount}} received for {{booking_reference}} (card ending {{card_last4}}). Thank you!'),

-- #16 Payment Failed
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PaymentFailed','email','Payment failed — action required',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#ef4444;margin:0 0 12px;">Payment Failed</h2><p style="color:#d1d5db;margin:0 0 20px;">Dear {{customer_name}}, we could not charge card ending {{card_last4}} for {{booking_reference}}. Please update your payment method.</p><a href="https://aschauffeured.chauffeurssolution.com/profile" style="background:#c8a96b;color:#000;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Update Payment</a><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PaymentFailed','sms','',
'ASChauffeured: Payment FAILED for {{booking_reference}}. Please update payment method urgently.'),

-- #17 Payment Request (email only)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PaymentRequest','email','Payment requested for {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Payment Required</h2><p style="color:#d1d5db;margin:0 0 8px;">Dear {{customer_name}}, payment of <strong style="color:#c8a96b;">{{total_price}}</strong> is required for booking {{booking_reference}}.</p><a href="{{payment_link}}" style="background:#c8a96b;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:16px;">Pay Now</a><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),

-- #18 Driver New Dispatch
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverNewDispatch','email','New job dispatched — {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">New Job Assigned</h2><p style="color:#d1d5db;margin:0 0 16px;">Hi {{driver_name}}, a new booking has been assigned to you.</p><div style="background:#0d0f14;border-radius:10px;border:1px solid #1f2937;padding:18px 22px;margin:0 0 16px;"><p style="margin:0 0 8px;color:#c8a96b;font-weight:bold;font-family:monospace;">{{booking_reference}}</p><p style="margin:0 0 6px;color:#e5e7eb;font-size:14px;">Pickup: {{pickup_address}}</p><p style="margin:0 0 6px;color:#e5e7eb;font-size:14px;">Drop-off: {{dropoff_address}}</p><p style="margin:0 0 6px;color:#e5e7eb;font-size:14px;">Time: {{pickup_time}}</p><p style="margin:0 0 6px;color:#e5e7eb;font-size:14px;">Passenger: {{customer_name}}</p><p style="margin:0;color:#c8a96b;font-size:15px;font-weight:bold;">Your pay: {{driver_pay}}</p></div><p style="color:#9ca3af;font-size:13px;">Preferences: {{passenger_preferences}}</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverNewDispatch','sms','',
'ASChauffeured NEW JOB: {{booking_reference}} | {{pickup_address}} → {{dropoff_address}} | {{pickup_time}} | Pax: {{customer_name}} | Pay: {{driver_pay}}'),

-- #20 Driver Rejection Recorded (SMS only)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverRejectedAssignment','sms','',
'ASChauffeured: Your rejection for {{booking_reference}} has been recorded. Thank you.'),

-- #21 Assignment Cancelled (driver)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AssignmentCancelled','sms','',
'ASChauffeured: Booking {{booking_reference}} cancelled. No action required from you.'),

-- #22 Pay Updated
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverPayUpdated','sms','',
'ASChauffeured: Pay for {{booking_reference}} updated. Check portal and reconfirm.'),

-- #23 Doc Expiry 30 days
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocExpiry30','email','Document expiring in 30 days — {{doc_type}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#fff;margin:0 0 12px;">Document Expiry Reminder</h2><p style="color:#d1d5db;">Hi {{driver_name}}, your <strong style="color:#c8a96b;">{{doc_type}}</strong> expires <strong>{{expiry_date}}</strong> (30 days). Upload a renewal to keep your account active.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocExpiry30','sms','',
'ASChauffeured: {{doc_type}} expires {{expiry_date}} (30 days). Upload renewal now.'),

-- #24 Doc Expiry 7 days
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocExpiry7','email','URGENT: Document expiring in 7 days — {{doc_type}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#ef4444;margin:0 0 12px;">URGENT: Document Expiring</h2><p style="color:#d1d5db;">Hi {{driver_name}}, your <strong style="color:#c8a96b;">{{doc_type}}</strong> expires <strong>{{expiry_date}}</strong> — only <strong style="color:#ef4444;">7 days</strong> left. Upload immediately to avoid suspension.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocExpiry7','sms','',
'URGENT ASChauffeured: {{doc_type}} expires {{expiry_date}} — 7 days left! Upload immediately.'),

-- #25 Account Suspended
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverAccountSuspended','email','Your driver account has been suspended',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#ef4444;margin:0 0 12px;">Account Suspended</h2><p style="color:#d1d5db;">Hi {{driver_name}}, your account is suspended because your <strong style="color:#c8a96b;">{{doc_type}}</strong> has expired. Upload a valid document to restore access.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverAccountSuspended','sms','',
'ASChauffeured: Account SUSPENDED. {{doc_type}} expired. Upload new doc to restore access.'),

-- #26 Doc Approved
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocApproved','email','Document approved — {{doc_type}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#22c55e;margin:0 0 12px;">Document Approved ✓</h2><p style="color:#d1d5db;">Hi {{driver_name}}, your <strong style="color:#c8a96b;">{{doc_type}}</strong> has been approved. You are ready to take bookings!</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocApproved','sms','',
'ASChauffeured: {{doc_type}} approved! You''re ready to take bookings.'),

-- #27 Doc Rejected
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocRejected','email','Document rejected — {{doc_type}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured</p><h2 style="color:#ef4444;margin:0 0 12px;">Document Rejected</h2><p style="color:#d1d5db;">Hi {{driver_name}}, your <strong style="color:#c8a96b;">{{doc_type}}</strong> was rejected. Reason: <strong>{{reject_reason}}</strong>. Please re-upload a valid document.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured · Sydney, Australia</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DriverDocRejected','sms','',
'ASChauffeured: {{doc_type}} REJECTED. Reason: {{reject_reason}}. Re-upload required.'),

-- #28 Admin New Booking
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminNewBooking','email','New booking — {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#fff;margin:0 0 12px;">New Booking Received</h2><p style="color:#d1d5db;">A new booking has been submitted. Please dispatch a driver.</p><div style="background:#0d0f14;border-radius:10px;border:1px solid #1f2937;padding:18px 22px;margin:16px 0;"><p style="margin:0 0 6px;color:#c8a96b;font-weight:bold;">{{booking_reference}}</p><p style="margin:0 0 6px;color:#e5e7eb;font-size:14px;">Customer: {{customer_name}}</p><p style="margin:0 0 6px;color:#e5e7eb;font-size:14px;">{{pickup_address}} → {{dropoff_address}}</p><p style="margin:0;color:#e5e7eb;font-size:14px;">{{pickup_time}} · {{total_price}}</p></div><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured Admin Portal</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminNewBooking','sms','',
'NEW BOOKING {{booking_reference}}: {{customer_name}} | {{pickup_address}} → {{dropoff_address}} | {{pickup_time}} | Dispatch driver now.'),

-- #29 Admin Booking Pending Confirm
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminBookingPendingConfirm','email','Booking pending confirmation — {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#fff;margin:0 0 12px;">Booking Awaiting Confirmation</h2><p style="color:#d1d5db;">{{customer_name}} submitted booking <strong style="color:#c8a96b;">{{booking_reference}}</strong>. Please confirm and process payment in the portal.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured Admin Portal</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminBookingPendingConfirm','sms','',
'PENDING: {{booking_reference}} from {{customer_name}} needs confirmation. Please confirm & charge.'),

-- #30 Admin Driver Rejected
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminDriverRejected','email','Driver rejected booking — {{booking_reference}}',
'<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#ef4444;margin:0 0 12px;">Driver Rejected Job</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{driver_name}}</strong> rejected booking <strong>{{booking_reference}}</strong>. Please reassign immediately.</p><p style="color:#4b5563;font-size:11px;margin-top:24px;border-top:1px solid #1f2937;padding-top:16px;">ASChauffeured Admin Portal</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminDriverRejected','sms','',
'ALERT: {{driver_name}} rejected {{booking_reference}}. Reassign now.'),

-- #31-39 Remaining Admin events
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminPartnerRejected','email','Partner rejected transfer — {{booking_reference}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#ef4444;margin:0 0 12px;">Transfer Rejected</h2><p style="color:#d1d5db;">Partner <strong style="color:#c8a96b;">{{partner_name}}</strong> rejected transfer for {{booking_reference}}. Handle manually.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminPartnerRejected','sms','','ALERT: {{partner_name}} rejected transfer for {{booking_reference}}. Handle manually.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminTransferRequest','email','Incoming transfer from {{source_tenant}} — {{booking_reference}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#fff;margin:0 0 12px;">Transfer Request</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{source_tenant}}</strong> sent transfer for {{booking_reference}} at {{transfer_price}}. Accept or reject in portal.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminTransferRequest','sms','','Transfer from {{source_tenant}}: {{booking_reference}} at {{transfer_price}}. Review in portal.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminPartnerAccepted','email','Partner accepted transfer — {{booking_reference}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#22c55e;margin:0 0 12px;">Transfer Accepted ✓</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{partner_name}}</strong> accepted transfer for {{booking_reference}} and will dispatch a driver.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminPartnerAccepted','sms','','{{partner_name}} accepted transfer for {{booking_reference}}. They will assign a driver.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminCollabRequest','email','Collaboration request from {{source_tenant}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#fff;margin:0 0 12px;">Collab Request</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{source_tenant}}</strong> sent a collaboration request. Review in portal.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminCollabRequest','sms','','New collab request from {{source_tenant}}. Review in portal.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminCollabApproved','email','Collaboration approved — {{partner_name}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#22c55e;margin:0 0 12px;">Collaboration Approved ✓</h2><p style="color:#d1d5db;">Collaboration with <strong style="color:#c8a96b;">{{partner_name}}</strong> approved. You can now transfer bookings.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminCollabApproved','sms','','Collab with {{partner_name}} approved! Booking transfers now enabled.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminDriverReview','email','Driver review — {{driver_name}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#fff;margin:0 0 12px;">Driver Review Result</h2><p style="color:#d1d5db;">{{driver_name}} review status: <strong style="color:#c8a96b;">{{review_status}}</strong>.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminDriverReview','sms','','Driver {{driver_name}} review: {{review_status}}. Check portal.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminInvoicePaid','email','Invoice paid — {{invoice_number}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#22c55e;margin:0 0 12px;">Invoice Paid ✓</h2><p style="color:#d1d5db;">Invoice <strong style="color:#c8a96b;">{{invoice_number}}</strong> for <strong>{{amount}}</strong> has been paid.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminInvoicePaid','sms','','Invoice {{invoice_number}} paid: {{amount}}.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminPaymentFailed','email','Payment failed — manual action required','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#ef4444;margin:0 0 12px;">Payment Failed</h2><p style="color:#d1d5db;">Payment failed for booking <strong style="color:#c8a96b;">{{booking_reference}}</strong>. Manual action required.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminPaymentFailed','sms','','ALERT: Payment failed for {{booking_reference}}. Manual action required.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminSettlement','email','Settlement completed — {{booking_reference}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">AS Chauffeured — Admin</p><h2 style="color:#fff;margin:0 0 12px;">Settlement Completed</h2><p style="color:#d1d5db;">Booking <strong style="color:#c8a96b;">{{booking_reference}}</strong> settlement: <strong>{{settlement_result}}</strong>.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','AdminSettlement','sms','','Settlement for {{booking_reference}}: {{settlement_result}}.'),

-- #40-42 Super Admin
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','SuperAdminDriverReview','email','New driver review request — {{driver_name}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">Platform Admin</p><h2 style="color:#fff;margin:0 0 12px;">Driver Review Required</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{driver_name}}</strong> from tenant <strong>{{tenant_name}}</strong> requires review.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','SuperAdminDriverReview','sms','','Platform: New driver review for {{driver_name}} ({{tenant_name}}). Action required.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','SuperAdminCollabReview','email','Collaboration review required — {{tenant_a}} + {{tenant_b}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">Platform Admin</p><h2 style="color:#fff;margin:0 0 12px;">Collab Review Required</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{tenant_a}}</strong> and <strong style="color:#c8a96b;">{{tenant_b}}</strong> have requested collaboration. Review in platform portal.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','SuperAdminCollabReview','sms','','Platform: Collab review needed: {{tenant_a}} + {{tenant_b}}.'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','SuperAdminNewTenant','email','New tenant registered — {{tenant_name}}','<!DOCTYPE html><html><body style="background:#0d0f14;margin:0;padding:30px;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;background:#111318;border-radius:16px;padding:36px;"><p style="color:#c8a96b;font-size:20px;font-weight:bold;margin:0 0 24px;">Platform Admin</p><h2 style="color:#fff;margin:0 0 12px;">New Tenant Registered</h2><p style="color:#d1d5db;"><strong style="color:#c8a96b;">{{tenant_name}}</strong> has registered. Please review and activate in the platform portal.</p></div></body></html>'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','SuperAdminNewTenant','sms','','Platform: New tenant {{tenant_name}} registered. Review & activate.')

ON CONFLICT(tenant_id,event_type,channel)
DO UPDATE SET subject=EXCLUDED.subject, body=EXCLUDED.body, updated_at=now();
