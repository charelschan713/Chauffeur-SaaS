export const EmailTemplates = {
  bookingConfirmed: (data: {
    passenger_name: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_datetime: string;
    vehicle_class: string;
    total_price: number;
    currency: string;
    booking_id: string;
  }) => ({
    subject: `Booking Confirmed – ${data.booking_id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>Your ride is confirmed! 🚗</h2>
      <p>Hi ${data.passenger_name},</p>
      <p>Your booking has been confirmed and payment received.</p>
      <table>
        <tr><td><b>From</b></td><td>${data.pickup_address}</td></tr>
        <tr><td><b>To</b></td><td>${data.dropoff_address}</td></tr>
        <tr><td><b>Pickup Time</b></td><td>${new Date(data.pickup_datetime).toLocaleString()}</td></tr>
        <tr><td><b>Vehicle</b></td><td>${data.vehicle_class}</td></tr>
        <tr><td><b>Total</b></td><td>${data.currency} ${data.total_price}</td></tr>
      </table>
      <p>We'll notify you when a driver is assigned.</p>
    `,
  }),

  driverAssigned: (data: {
    passenger_name: string;
    driver_name: string;
    driver_phone: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_color: string;
    plate_number: string;
    pickup_datetime: string;
  }) => ({
    subject: 'Your driver has been assigned',
    html: `
      <h2>Driver Assigned 🙌</h2>
      <p>Hi ${data.passenger_name},</p>
      <p>Your driver is confirmed for your upcoming ride.</p>
      <table>
        <tr><td><b>Driver</b></td><td>${data.driver_name}</td></tr>
        <tr><td><b>Phone</b></td><td>${data.driver_phone}</td></tr>
        <tr><td><b>Vehicle</b></td><td>${data.vehicle_color} ${data.vehicle_make} ${data.vehicle_model}</td></tr>
        <tr><td><b>Plate</b></td><td>${data.plate_number}</td></tr>
        <tr><td><b>Pickup Time</b></td><td>${new Date(data.pickup_datetime).toLocaleString()}</td></tr>
      </table>
    `,
  }),

  newTripAssigned: (data: {
    driver_name: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_datetime: string;
    passenger_count: number;
    special_requests?: string;
  }) => ({
    subject: 'New trip assigned to you',
    html: `
      <h2>New Trip Assignment 📋</h2>
      <p>Hi ${data.driver_name},</p>
      <p>You have been assigned a new trip.</p>
      <table>
        <tr><td><b>From</b></td><td>${data.pickup_address}</td></tr>
        <tr><td><b>To</b></td><td>${data.dropoff_address}</td></tr>
        <tr><td><b>Pickup Time</b></td><td>${new Date(data.pickup_datetime).toLocaleString()}</td></tr>
        <tr><td><b>Passengers</b></td><td>${data.passenger_count}</td></tr>
        ${data.special_requests ? `<tr><td><b>Notes</b></td><td>${data.special_requests}</td></tr>` : ''}
      </table>
    `,
  }),

  tripCompleted: (data: {
    passenger_name: string;
    pickup_address: string;
    dropoff_address: string;
    total_price: number;
    currency: string;
  }) => ({
    subject: 'Trip Completed – Thank you!',
    html: `
      <h2>Trip Completed ✅</h2>
      <p>Hi ${data.passenger_name},</p>
      <p>Your ride has been completed. Thank you for riding with us!</p>
      <table>
        <tr><td><b>From</b></td><td>${data.pickup_address}</td></tr>
        <tr><td><b>To</b></td><td>${data.dropoff_address}</td></tr>
        <tr><td><b>Total Charged</b></td><td>${data.currency} ${data.total_price}</td></tr>
      </table>
    `,
  }),

  bookingCancelled: (data: {
    passenger_name: string;
    booking_id: string;
    refund_amount?: number;
    currency?: string;
  }) => ({
    subject: 'Booking Cancelled',
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi ${data.passenger_name},</p>
      <p>Your booking <b>${data.booking_id.slice(0, 8).toUpperCase()}</b> has been cancelled.</p>
      ${
        data.refund_amount
          ? `<p>A refund of <b>${data.currency} ${data.refund_amount}</b> will be returned to your original payment method within 5-10 business days.</p>`
          : ''
      }
    `,
  }),

  tenantPendingApproval: (data: {
    admin_name: string;
    company_name: string;
  }) => ({
    subject: 'Your application is under review',
    html: `
      <h2>Application Received 📝</h2>
      <p>Hi ${data.admin_name},</p>
      <p>We've received your application for <b>${data.company_name}</b>.</p>
      <p>Our team will review it within 1-2 business days and notify you once approved.</p>
    `,
  }),

  tenantApproved: (data: {
    admin_name: string;
    company_name: string;
    dashboard_url: string;
  }) => ({
    subject: 'Your account has been approved! 🎉',
    html: `
      <h2>Welcome aboard, ${data.company_name}!</h2>
      <p>Hi ${data.admin_name},</p>
      <p>Your account has been approved. You can now log in and start managing your fleet.</p>
      <p><a href="${data.dashboard_url}">Go to Dashboard →</a></p>
    `,
  }),
};
