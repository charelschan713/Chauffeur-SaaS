export function bookingConfirmedSms(vars: {
  bookingReference: string;
  pickupTime: string;
}): string {
  return 'Booking {{booking_reference}} confirmed. Pickup: {{pickup_address}} at {{pickup_time}}';
}

export function driverAcceptedSms(vars: {
  bookingReference: string;
  driverName: string;
}): string {
  return '{{driver_name}} is your driver for booking {{booking_reference}}. Vehicle: {{vehicle_make}} {{vehicle_model}}';
}

export function driverInvitationSms(vars: {
  bookingReference: string;
  pickupAddress: string;
  pickupTime: string;
}): string {
  return 'New job {{booking_reference}}: Passenger {{passenger_name}} ({{passenger_phone}}). Pickup {{pickup_address}} at {{pickup_time}}. Accept in app.';
}

export function jobCompletedSms(vars: {
  bookingReference: string;
}): string {
  return 'Trip {{booking_reference}} completed. Total: {{currency}} {{total_amount}}. Thank you!';
}

export function bookingCancelledSms(vars: {
  bookingReference: string;
}): string {
  return 'Booking {{booking_reference}} has been cancelled.';
}

export function driverRejectedAdminSms(): string {
  return 'Driver {{driver_name}} rejected booking {{booking_reference}}. Please reassign in admin portal.';
}

export function assignmentCancelledSms(): string {
  return 'Booking {{booking_reference}} has been reassigned. Your assignment is cancelled.';
}

export function driverPayUpdatedSms(): string {
  return 'Job {{booking_reference}} details updated. Please review and re-accept in the app.';
}
