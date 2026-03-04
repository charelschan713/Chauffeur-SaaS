export const PLATFORM_DEFAULT_TEMPLATES: Record<
  string,
  Record<'email' | 'sms', { subject?: string; body: string }>
> = {
  BookingConfirmed: {
    email: {
      subject: 'Booking Confirmed — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your booking is confirmed</h2>
        <p>Dear {{customer_first_name}} {{customer_last_name}},</p>
        <p>Your booking <strong>{{booking_reference}}</strong> has been confirmed.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; color: #666;">Pickup</td><td style="padding: 8px;"><strong>{{pickup_address}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Dropoff</td><td style="padding: 8px;"><strong>{{dropoff_address}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Date & Time</td><td style="padding: 8px;"><strong>{{pickup_time}}</strong></td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">If you have any questions, please contact us.</p>
      </div>`,
    },
    sms: {
      body: 'Booking {{booking_reference}} confirmed. Pickup: {{pickup_address}} at {{pickup_time}}',
    },
  },
  DriverAcceptedAssignment: {
    email: {
      subject: 'Your Driver is on the Way — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your driver has been assigned</h2>
        <p>Dear {{customer_first_name}},</p>
        <p>Your driver <strong>{{driver_name}}</strong> has accepted your booking.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; color: #666;">Driver</td><td style="padding: 8px;"><strong>{{driver_name}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Vehicle</td><td style="padding: 8px;"><strong>{{vehicle_make}} {{vehicle_model}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Pickup</td><td style="padding: 8px;"><strong>{{pickup_address}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Time</td><td style="padding: 8px;"><strong>{{pickup_time}}</strong></td></tr>
        </table>
      </div>`,
    },
    sms: {
      body: '{{driver_name}} is your driver for booking {{booking_reference}}. Vehicle: {{vehicle_make}} {{vehicle_model}}',
    },
  },
  DriverInvitationSent: {
    email: {
      subject: 'New Job Assignment — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">New Job Available</h2>
        <p>You have a new job assignment:</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; color: #666;">Booking</td><td style="padding: 8px;"><strong>{{booking_reference}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Passenger</td><td style="padding: 8px;"><strong>{{passenger_name}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Pickup</td><td style="padding: 8px;"><strong>{{pickup_address}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Time</td><td style="padding: 8px;"><strong>{{pickup_time}}</strong></td></tr>
        </table>
        <p>Please accept or decline in the driver app.</p>
      </div>`,
    },
    sms: {
      body: 'New job {{booking_reference}}: Passenger {{passenger_name}} ({{passenger_phone}}). Pickup {{pickup_address}} at {{pickup_time}}. Accept in app.',
    },
  },
  JobCompleted: {
    email: {
      subject: 'Trip Completed — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Thank you for riding with us</h2>
        <p>Dear {{customer_first_name}},</p>
        <p>Your trip <strong>{{booking_reference}}</strong> has been completed.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; color: #666;">Total</td><td style="padding: 8px;"><strong>{{currency}} {{total_amount}}</strong></td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Thank you for choosing our service.</p>
      </div>`,
    },
    sms: {
      body: 'Trip {{booking_reference}} completed. Total: {{currency}} {{total_amount}}. Thank you!',
    },
  },
  BookingCancelled: {
    email: {
      subject: 'Booking Cancelled — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your booking has been cancelled</h2>
        <p>Dear {{customer_first_name}},</p>
        <p>Your booking <strong>{{booking_reference}}</strong> has been cancelled.</p>
        <p style="color: #666; font-size: 14px;">If you did not request this cancellation, please contact us.</p>
      </div>`,
    },
    sms: {
      body: 'Booking {{booking_reference}} has been cancelled.',
    },
  },
  DriverRejectedAssignment: {
    email: {
      subject: 'Driver Rejected Assignment — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c0392b;">Driver Rejected Assignment</h2>
        <p>Driver <strong>{{driver_name}}</strong> has rejected the assignment for booking <strong>{{booking_reference}}</strong>.</p>
        <p>Please log in to the admin portal to reassign a driver.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; color: #666;">Booking</td><td style="padding: 8px;"><strong>{{booking_reference}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Driver</td><td style="padding: 8px;"><strong>{{driver_name}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Pickup</td><td style="padding: 8px;"><strong>{{pickup_address}}</strong></td></tr>
          <tr><td style="padding: 8px; color: #666;">Time</td><td style="padding: 8px;"><strong>{{pickup_time}}</strong></td></tr>
        </table>
      </div>`,
    },
    sms: {
      body: 'Driver {{driver_name}} rejected booking {{booking_reference}}. Please reassign in admin portal.',
    },
  },
  AssignmentCancelled: {
    email: {
      subject: 'Assignment Cancelled — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Assignment Cancelled</h2>
        <p>Booking {{booking_reference}} has been reassigned. Your assignment is cancelled.</p>
      </div>`,
    },
    sms: {
      body: 'Booking {{booking_reference}} has been reassigned. Your assignment is cancelled.',
    },
  },
  DriverPayUpdated: {
    email: {
      subject: 'Job Details Updated — {{booking_reference}}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Job Details Updated</h2>
        <p>Job {{booking_reference}} details have been updated. Please review and re-accept in the app.</p>
      </div>`,
    },
    sms: {
      body: 'Job {{booking_reference}} details updated. Please review and re-accept in the app.',
    },
  },
};
