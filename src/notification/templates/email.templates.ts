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
    subject: 'Booking Confirmed — {{booking_reference}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your booking is confirmed</h2>
        <p>Dear {{customer_first_name}} {{customer_last_name}},</p>
        <p>Your booking <strong>{{booking_reference}}</strong> has been confirmed.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; color: #666;">Pickup</td>
            <td style="padding: 8px;"><strong>{{pickup_address}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Dropoff</td>
            <td style="padding: 8px;"><strong>{{dropoff_address}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Date & Time</td>
            <td style="padding: 8px;"><strong>{{pickup_time}}</strong></td>
          </tr>
        </table>
        <p style="color: #666; font-size: 14px;">If you have any questions, please contact us.</p>
      </div>
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
    subject: 'Your Driver is on the Way — {{booking_reference}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your driver has been assigned</h2>
        <p>Dear {{customer_first_name}},</p>
        <p>Your driver <strong>{{driver_name}}</strong> has accepted your booking.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; color: #666;">Driver</td>
            <td style="padding: 8px;"><strong>{{driver_name}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Vehicle</td>
            <td style="padding: 8px;"><strong>{{vehicle_make}} {{vehicle_model}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Pickup</td>
            <td style="padding: 8px;"><strong>{{pickup_address}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Time</td>
            <td style="padding: 8px;"><strong>{{pickup_time}}</strong></td>
          </tr>
        </table>
      </div>
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
    subject: 'Trip Completed — {{booking_reference}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Thank you for riding with us</h2>
        <p>Dear {{customer_first_name}},</p>
        <p>Your trip <strong>{{booking_reference}}</strong> has been completed.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; color: #666;">Total</td>
            <td style="padding: 8px;"><strong>{{currency}} {{total_amount}}</strong></td>
          </tr>
        </table>
        <p style="color: #666; font-size: 14px;">Thank you for choosing our service.</p>
      </div>
    `,
  };
}

export function bookingCancelledEmail(vars: {
  bookingReference: string;
  customerName: string;
}): EmailTemplate {
  return {
    subject: 'Booking Cancelled — {{booking_reference}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your booking has been cancelled</h2>
        <p>Dear {{customer_first_name}},</p>
        <p>Your booking <strong>{{booking_reference}}</strong> has been cancelled.</p>
        <p style="color: #666; font-size: 14px;">If you did not request this cancellation, please contact us.</p>
      </div>
    `,
  };
}

export function driverRejectedAdminEmail(vars: {
  bookingReference: string;
  driverName: string;
}): EmailTemplate {
  return {
    subject: 'Driver Rejected Assignment — {{booking_reference}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c0392b;">Driver Rejected Assignment</h2>
        <p>Driver <strong>{{driver_name}}</strong> has rejected the assignment for booking <strong>{{booking_reference}}</strong>.</p>
        <p>Please log in to the admin portal to reassign a driver.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; color: #666;">Booking</td>
            <td style="padding: 8px;"><strong>{{booking_reference}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Driver</td>
            <td style="padding: 8px;"><strong>{{driver_name}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Pickup</td>
            <td style="padding: 8px;"><strong>{{pickup_address}}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Time</td>
            <td style="padding: 8px;"><strong>{{pickup_time}}</strong></td>
          </tr>
        </table>
      </div>
    `,
  };
}
