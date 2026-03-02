import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IntegrationResolver } from '../integration/integration.resolver';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import {
  bookingConfirmedEmail,
  driverAcceptedEmail,
  jobCompletedEmail,
  bookingCancelledEmail,
} from './templates/email.templates';
import {
  bookingConfirmedSms,
  driverAcceptedSms,
  driverInvitationSms,
  jobCompletedSms,
  bookingCancelledSms,
} from './templates/sms.templates';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly integrationResolver: IntegrationResolver,
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SmsProvider,
  ) {}

  async handleEvent(eventType: string, payload: any): Promise<void> {
    const tenantId = payload.tenant_id;
    if (!tenantId) return;

    switch (eventType) {
      case 'BookingConfirmed':
        await this.onBookingConfirmed(tenantId, payload);
        break;
      case 'DriverAcceptedAssignment':
        await this.onDriverAccepted(tenantId, payload);
        break;
      case 'DriverInvitationSent':
        await this.onDriverInvitation(tenantId, payload);
        break;
      case 'JobCompleted':
        await this.onJobCompleted(tenantId, payload);
        break;
      case 'BookingCancelled':
        await this.onBookingCancelled(tenantId, payload);
        break;
    }
  }

  private async onBookingConfirmed(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    if (emailIntegration && booking.customer_email) {
      const template = bookingConfirmedEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        pickupTime: booking.pickup_at_utc,
      });
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: template.subject,
        html: template.html,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = bookingConfirmedSms({
        bookingReference: booking.booking_reference,
        pickupTime: booking.pickup_at_utc,
      });
      await this.smsProvider.send(smsIntegration, booking.customer_phone, msg);
    }
  }

  private async onDriverAccepted(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver = await this.getDriver(payload.driver_id);
    if (!booking || !driver) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    if (emailIntegration && booking.customer_email) {
      const template = driverAcceptedEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
        driverName: driver.full_name,
        vehicleMake: '',
        vehicleModel: '',
      });
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: template.subject,
        html: template.html,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = driverAcceptedSms({
        bookingReference: booking.booking_reference,
        driverName: driver.full_name,
      });
      await this.smsProvider.send(smsIntegration, booking.customer_phone, msg);
    }
  }

  private async onDriverInvitation(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver = await this.getDriver(payload.driver_id);
    if (!booking || !driver) return;

    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    if (smsIntegration && driver.phone) {
      const msg = driverInvitationSms({
        bookingReference: booking.booking_reference,
        pickupAddress: booking.pickup_address,
        pickupTime: booking.pickup_at_utc,
      });
      await this.smsProvider.send(smsIntegration, driver.phone, msg);
    }
  }

  private async onJobCompleted(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    const totalAmount = booking.total_price_minor
      ? (booking.total_price_minor / 100).toFixed(2)
      : '0.00';

    if (emailIntegration && booking.customer_email) {
      const template = jobCompletedEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
        totalAmount,
        currency: booking.currency ?? 'AUD',
      });
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: template.subject,
        html: template.html,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = jobCompletedSms({
        bookingReference: booking.booking_reference,
      });
      await this.smsProvider.send(smsIntegration, booking.customer_phone, msg);
    }
  }

  private async onBookingCancelled(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    if (emailIntegration && booking.customer_email) {
      const template = bookingCancelledEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
      });
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: template.subject,
        html: template.html,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = bookingCancelledSms({
        bookingReference: booking.booking_reference,
      });
      await this.smsProvider.send(smsIntegration, booking.customer_phone, msg);
    }
  }

  private async getBooking(bookingId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         id,
         booking_reference,
         tenant_id,
         customer_email,
         customer_phone_country_code,
         customer_phone_number,
         customer_first_name,
         customer_last_name,
         pickup_address_text as pickup_address,
         dropoff_address_text as dropoff_address,
         pickup_at_utc,
         total_price_minor,
         currency
       FROM public.bookings
       WHERE id = $1`,
      [bookingId],
    );
    if (!rows.length) return null;
    const booking = rows[0];
    const phone = booking.customer_phone_number
      ? `${booking.customer_phone_country_code ?? ''}${booking.customer_phone_number}`
      : null;
    return {
      ...booking,
      customer_phone: phone,
    };
  }

  private async getDriver(driverId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, full_name, email, phone FROM public.users WHERE id = $1`,
      [driverId],
    );
    return rows[0] ?? null;
  }
}
