-- Add recipients config to notification templates
-- recipients: jsonb array of strings, e.g. ["customer","driver","admin"]
ALTER TABLE public.tenant_notification_templates
  ADD COLUMN IF NOT EXISTS recipients jsonb NOT NULL DEFAULT '["customer"]'::jsonb;

-- Fix defaults per event category
-- Driver events → recipient = driver
UPDATE public.tenant_notification_templates
SET recipients = '["driver"]'::jsonb
WHERE event_type IN (
  'DriverNewDispatch','DriverAcceptedAssignment','DriverRejectedAssignment',
  'AssignmentCancelled','DriverPayUpdated',
  'DriverDocExpiry30','DriverDocExpiry7','DriverAccountSuspended',
  'DriverDocApproved','DriverDocRejected','DriverInvitationSent','DriverInviteSms','DriverInviteEmail'
);

-- Admin events → recipient = admin
UPDATE public.tenant_notification_templates
SET recipients = '["admin"]'::jsonb
WHERE event_type IN (
  'AdminNewBooking','AdminBookingPendingConfirm','AdminDriverRejected',
  'AdminPartnerRejected','AdminTransferRequest','AdminPartnerAccepted',
  'AdminCollabRequest','AdminCollabApproved','AdminDriverReview',
  'AdminInvoicePaid','AdminPaymentFailed','AdminSettlement',
  'SuperAdminDriverReview','SuperAdminCollabReview','SuperAdminNewTenant'
);

-- Customer events → recipient = customer (already default, explicit for clarity)
UPDATE public.tenant_notification_templates
SET recipients = '["customer"]'::jsonb
WHERE event_type IN (
  'BookingConfirmed','BookingCancelled','BookingCancelledByAdmin',
  'CustomerRegistered','CustomerForgotPassword','CustomerOtp',
  'TripStarted','JobCompleted','JobFulfilledWithExtras',
  'RefundIssued','InvoiceSent','InvoiceOverdue',
  'PaymentSuccess','PaymentFailed','PaymentRequest'
);
