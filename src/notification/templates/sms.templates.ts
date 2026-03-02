export function bookingConfirmedSms(vars: {
  bookingReference: string;
  pickupTime: string;
}): string {
  return `Booking ${vars.bookingReference} confirmed. Pickup: ${vars.pickupTime}`;
}

export function driverAcceptedSms(vars: {
  bookingReference: string;
  driverName: string;
}): string {
  return `${vars.driverName} has accepted your booking ${vars.bookingReference}.`;
}

export function driverInvitationSms(vars: {
  bookingReference: string;
  pickupAddress: string;
  pickupTime: string;
}): string {
  return `New job: ${vars.bookingReference}. Pickup: ${vars.pickupAddress} at ${vars.pickupTime}. Accept in app.`;
}

export function jobCompletedSms(vars: {
  bookingReference: string;
}): string {
  return `Trip ${vars.bookingReference} completed. Thank you for riding with us.`;
}

export function bookingCancelledSms(vars: {
  bookingReference: string;
}): string {
  return `Booking ${vars.bookingReference} has been cancelled.`;
}
