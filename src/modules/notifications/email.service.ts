import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  async sendBookingConfirmation(params: {
    to: string;
    first_name: string;
    booking_number: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_datetime: string;
    vehicle_type_name: string;
    total_fare: number;
    is_new_account: boolean;
    temp_password?: string;
    booking_url: string;
  }) {
    const subject = `Booking Confirmed - ${params.booking_number}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${params.first_name},</h2>
        <p>Your booking has been confirmed!</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px;">Booking Details</h3>
          <p><strong>Booking Number:</strong> ${params.booking_number}</p>
          <p><strong>Pickup:</strong> ${params.pickup_address}</p>
          <p><strong>Dropoff:</strong> ${params.dropoff_address}</p>
          <p><strong>Date/Time:</strong> ${new Date(params.pickup_datetime).toLocaleString('en-AU')}</p>
          <p><strong>Vehicle:</strong> ${params.vehicle_type_name}</p>
          <p><strong>Total:</strong> AUD $${Number(params.total_fare || 0).toFixed(2)}</p>
        </div>

        ${
          params.is_new_account
            ? `
        <div style="background: #e8f4e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px;">Your Account</h3>
          <p>We've created an account for you to track your bookings.</p>
          <p><strong>Email:</strong> ${params.to}</p>
          <p><strong>Temporary Password:</strong> ${params.temp_password}</p>
          <p>Please change your password after logging in.</p>
          <a href="${params.booking_url}/login"
             style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">
            Login to View Booking
          </a>
        </div>
        `
            : `
        <a href="${params.booking_url}/account/bookings"
           style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Booking
        </a>
        `
        }

        <p style="color: #666; margin-top: 30px;">
          Thank you for choosing AS Chauffeured.
        </p>
      </div>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'bookings@aschauffeured.com.au',
      to: params.to,
      subject,
      html,
    });
  }
}
