export interface EmailTemplate {
  subject: string;
  html: string;
}

export function bookingConfirmedEmail(vars: {
  bookingReference: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
}): EmailTemplate {
  return {
    subject: `Booking Confirmed — ${vars.bookingReference}`,
    html: `
      <h2>Your booking is confirmed</h2>
      <p>Dear ${vars.customerName},</p>
      <p>Your booking <strong>${vars.bookingReference}</strong> has been confirmed.</p>
      <p><strong>Pickup:</strong> ${vars.pickupAddress}</p>
      <p><strong>Dropoff:</strong> ${vars.dropoffAddress}</p>
      <p><strong>Time:</strong> ${vars.pickupTime}</p>
    `,
  };
}

export function driverAcceptedEmail(vars: {
  bookingReference: string;
  customerName: string;
  driverName: string;
  vehicleMake: string;
  vehicleModel: string;
}): EmailTemplate {
  return {
    subject: `Driver Assigned — ${vars.bookingReference}`,
    html: `
      <h2>Your driver is on the way</h2>
      <p>Dear ${vars.customerName},</p>
      <p>Your driver <strong>${vars.driverName}</strong> has accepted your booking.</p>
      <p><strong>Vehicle:</strong> ${vars.vehicleMake} ${vars.vehicleModel}</p>
    `,
  };
}

export function jobCompletedEmail(vars: {
  bookingReference: string;
  customerName: string;
  totalAmount: string;
  currency: string;
}): EmailTemplate {
  return {
    subject: `Trip Completed — ${vars.bookingReference}`,
    html: `
      <h2>Thank you for riding with us</h2>
      <p>Dear ${vars.customerName},</p>
      <p>Your trip <strong>${vars.bookingReference}</strong> has been completed.</p>
      <p><strong>Total:</strong> ${vars.currency} ${vars.totalAmount}</p>
    `,
  };
}

export function bookingCancelledEmail(vars: {
  bookingReference: string;
  customerName: string;
}): EmailTemplate {
  return {
    subject: `Booking Cancelled — ${vars.bookingReference}`,
    html: `
      <h2>Your booking has been cancelled</h2>
      <p>Dear ${vars.customerName},</p>
      <p>Your booking <strong>${vars.bookingReference}</strong> has been cancelled.</p>
    `,
  };
}
