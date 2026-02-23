-- =====================
-- 通知系统补充：默认模版种子数据
-- =====================

-- 兼容已有结构：若表/策略已存在则跳过，仅补充模板

INSERT INTO notification_templates (
  tenant_id, template_id, notification_channel,
  recipient_type, subject, body, is_active, is_default
) VALUES

(NULL, 'BOOKING_RECEIVED', 'EMAIL', 'BOOKER',
'Booking Received - {{booking_number}}',
'Dear {{booker_name}},

Thank you for your booking request.

Booking Details:
• Booking #: {{booking_number}}
• Date & Time: {{pickup_datetime_local}}
• Pickup: {{pickup_address}}
• Drop-off: {{dropoff_address}}
• Vehicle: {{vehicle_class}}
• Passenger: {{passenger_name}}
• Total: {{currency}} ${{total_price}}

Your booking is currently under review. We will confirm shortly.

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_CONFIRMED', 'EMAIL', 'BOOKER',
'Booking Confirmed - {{booking_number}}',
'Dear {{booker_name}},

Your booking has been confirmed and payment processed.

Booking Details:
• Booking #: {{booking_number}}
• Date & Time: {{pickup_datetime_local}}
• Pickup: {{pickup_address}}
• Drop-off: {{dropoff_address}}
• Vehicle: {{vehicle_class}}
• Passenger: {{passenger_name}}

Payment Summary:
• Fare: {{currency}} ${{fare}}
• Toll: {{currency}} ${{toll}}
• Surcharge: {{currency}} ${{surcharge_amount}}
• Total Charged: {{currency}} ${{total_price}}

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_CONFIRMED', 'SMS', 'PASSENGER',
NULL,
'Your ride is confirmed!
Date: {{pickup_date}}
Time: {{pickup_time}} ({{pickup_city}})
Pickup: {{pickup_address}}
Booking #{{booking_number}}
{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_DECLINED', 'EMAIL', 'BOOKER',
'Booking Declined - {{booking_number}}',
'Dear {{booker_name}},

Unfortunately we are unable to accommodate your booking request.

Booking #: {{booking_number}}
Date & Time: {{pickup_datetime_local}}

Please contact us if you have any questions.

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_PAYMENT_REQUEST', 'EMAIL', 'BOOKER',
'Action Required: Confirm Your Booking - {{booking_number}}',
'Dear {{booker_name}},

Your booking has been created. Please confirm and complete payment.

Booking Details:
• Booking #: {{booking_number}}
• Date & Time: {{pickup_datetime_local}}
• Pickup: {{pickup_address}}
• Drop-off: {{dropoff_address}}
• Vehicle: {{vehicle_class}}
• Passenger: {{passenger_name}}
• Total: {{currency}} ${{total_price}}

Please click below to confirm and pay:
{{confirm_url}}

This link expires in 72 hours.

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'DRIVER_ASSIGNED', 'EMAIL', 'BOOKER',
'Driver Assigned - {{booking_number}}',
'Dear {{booker_name}},

A driver has been assigned for your booking.

Driver Details:
• Name: {{driver_name}}
• Vehicle: {{vehicle_make}} {{vehicle_model}}
• Plate: {{plate_number}}
• Color: {{vehicle_color}}

Booking #: {{booking_number}}
Date & Time: {{pickup_datetime_local}}

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'DRIVER_ON_THE_WAY', 'SMS', 'PASSENGER',
NULL,
'Your driver is on the way!
Driver: {{driver_name}}
Vehicle: {{vehicle_color}} {{vehicle_make}} {{vehicle_model}}
Plate: {{plate_number}}
Booking: {{pickup_date}} {{pickup_time}} ({{pickup_city}})
{{tenant_name}}',
TRUE, TRUE),

(NULL, 'DRIVER_ARRIVED', 'SMS', 'PASSENGER',
NULL,
'Your driver has arrived!
Please proceed to: {{pickup_address}}
Driver: {{driver_name}}
Plate: {{plate_number}}
Booking #{{booking_number}}
{{tenant_name}}',
TRUE, TRUE),

(NULL, 'TRIP_COMPLETED', 'EMAIL', 'BOOKER',
'Trip Completed - Receipt {{booking_number}}',
'Dear {{booker_name}},

Your trip has been completed. Thank you for choosing us.

Trip Summary:
• Booking #: {{booking_number}}
• Date: {{pickup_datetime_local}}
• Route: {{pickup_address}} → {{dropoff_address}}
• Driver: {{driver_name}}
• Vehicle: {{vehicle_make}} {{vehicle_model}}

Payment Receipt:
• Fare: {{currency}} ${{fare}}
• Toll: {{currency}} ${{toll}}
• Extras: {{currency}} ${{extras}}
• Surcharge: {{currency}} ${{surcharge_amount}}
• Discount: -{{currency}} ${{discount_amount}}
• Total Paid: {{currency}} ${{total_price}}

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_MODIFIED', 'EMAIL', 'BOOKER',
'Booking Updated - {{booking_number}}',
'Dear {{booker_name}},

Your booking has been updated.

Booking #: {{booking_number}}
New Date & Time: {{pickup_datetime_local}}
New Total: {{currency}} ${{total_price}}

{{modify_note}}

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'SUPPLEMENT_CHARGED', 'EMAIL', 'BOOKER',
'Additional Charge - {{booking_number}}',
'Dear {{booker_name}},

An additional charge has been applied to your booking.

Booking #: {{booking_number}}
Additional Amount: {{currency}} ${{supplement_amount}}
Reason: {{note}}

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'CREDIT_NOTE_ISSUED', 'EMAIL', 'BOOKER',
'Refund Issued - {{booking_number}}',
'Dear {{booker_name}},

A refund has been issued for your booking.

Booking #: {{booking_number}}
Refund Amount: {{currency}} ${{credit_amount}}
Reason: {{note}}

Please allow 3-5 business days for the refund to appear.

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_CANCELLED', 'EMAIL', 'BOOKER',
'Booking Cancelled - {{booking_number}}',
'Dear {{booker_name}},

Your booking has been cancelled.

Booking #: {{booking_number}}
Cancellation Fee: {{currency}} ${{cancellation_fee}}
Refund Amount: {{currency}} ${{refunded_amount}}

Please allow 3-5 business days for the refund.

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'BOOKING_CANCELLED', 'SMS', 'PASSENGER',
NULL,
'Your booking has been cancelled.
Booking #{{booking_number}}
{{pickup_date}} {{pickup_time}} ({{pickup_city}})
Contact us if you have questions.
{{tenant_name}}',
TRUE, TRUE),

(NULL, 'NO_SHOW', 'EMAIL', 'BOOKER',
'No Show - {{booking_number}}',
'Dear {{booker_name}},

Our driver arrived at the pickup location but was unable to locate the passenger.

Booking #: {{booking_number}}
Date & Time: {{pickup_datetime_local}}
Pickup: {{pickup_address}}

Please contact us if you have any questions.

{{tenant_name}}',
TRUE, TRUE),

(NULL, 'DRIVER_INVITED', 'SMS', 'DRIVER',
NULL,
'You have been invited to join {{tenant_name}} as a driver.
Download the app and register:
{{invite_url}}
Code: {{invite_code}}',
TRUE, TRUE),

(NULL, 'DRIVER_APPROVED', 'PUSH', 'DRIVER',
'Account Approved!',
'Your driver account has been approved. You can now receive bookings.',
TRUE, TRUE),

(NULL, 'JOB_ASSIGNED', 'PUSH', 'DRIVER',
'New Job Assigned!',
'You have a new job on {{pickup_date}} at {{pickup_time}} ({{pickup_city}}). Tap to view details.',
TRUE, TRUE),

(NULL, 'JOB_CANCELLED', 'PUSH', 'DRIVER',
'Job Cancelled',
'Booking #{{booking_number}} has been cancelled.',
TRUE, TRUE),

(NULL, 'BOOKING_MODIFIED', 'PUSH', 'DRIVER',
'Booking Updated',
'Booking #{{booking_number}} has been updated. Please check the new details.',
TRUE, TRUE),

(NULL, 'TENANT_APPROVED', 'EMAIL', 'TENANT',
'Your Account Has Been Approved',
'Dear {{tenant_name}},

Congratulations! Your account has been approved.

You can now log in and start setting up your fleet:
{{dashboard_url}}

Welcome aboard!

Chauffeur Platform',
TRUE, TRUE),

(NULL, 'TENANT_DECLINED', 'EMAIL', 'TENANT',
'Account Application Update',
'Dear {{tenant_name}},

Thank you for your interest. Unfortunately we are unable to approve your account at this time.

Please contact support if you have any questions.

Chauffeur Platform',
TRUE, TRUE),

(NULL, 'TRANSFER_RECEIVED', 'EMAIL', 'TENANT',
'Transfer Request - {{booking_number}}',
'Dear {{tenant_name}},

You have received a transfer request from {{from_tenant_name}}.

Booking Details:
• Booking #: {{booking_number}}
• Date & Time: {{pickup_datetime_local}}
• Pickup: {{pickup_address}}
• Drop-off: {{dropoff_address}}
• Vehicle: {{vehicle_class}}
• Your Share: {{to_percentage}}%

Please log in to accept or decline:
{{dashboard_url}}

Chauffeur Platform',
TRUE, TRUE)
ON CONFLICT (tenant_id, template_id, notification_channel, recipient_type) DO NOTHING;
