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
  return 'New job {{booking_reference}}: Pickup {{pickup_address}} at {{pickup_time}}. Accept in app.';
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
