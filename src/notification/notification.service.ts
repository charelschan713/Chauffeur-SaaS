import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IntegrationResolver } from '../integration/integration.resolver';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { TemplateResolver } from './template.resolver';
import { renderTemplate, TemplateVariables } from './template.renderer';
import {
  bookingConfirmedEmail,
  driverAcceptedEmail,
  jobCompletedEmail,
  bookingCancelledEmail,
  driverRejectedAdminEmail,
} from './templates/email.templates';
import {
  bookingConfirmedSms,
  driverAcceptedSms,
  driverInvitationSms,
  jobCompletedSms,
  bookingCancelledSms,
  driverRejectedAdminSms,
  assignmentCancelledSms,
  driverPayUpdatedSms,
} from './templates/sms.templates';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly integrationResolver: IntegrationResolver,
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SmsProvider,
    private readonly templateResolver: TemplateResolver,
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
      case 'DriverRejectedAssignment':
        await this.onDriverRejectedAssignment(tenantId, payload);
        break;
      case 'AssignmentCancelled':
        await this.onAssignmentCancelled(tenantId, payload);
        break;
      case 'DriverPayUpdated':
        await this.onDriverPayUpdated(tenantId, payload);
        break;
    }
  }

  private async onBookingConfirmed(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    this.logger.log(
      `SMS integration: ${JSON.stringify({ found: !!smsIntegration, provider: smsIntegration?.provider })}`,
    );
    this.logger.log(`Customer phone: ${booking?.customer_phone}`);

    const vars = await this.buildTemplateVars(tenantId, booking);

    if (emailIntegration && booking.customer_email) {
      const platformEmailTemplate = bookingConfirmedEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        pickupTime: booking.pickup_at_utc,
      });
      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingConfirmed',
        'email',
        { subject: platformEmailTemplate.subject, body: platformEmailTemplate.html, source: 'PLATFORM' },
      );
      const renderedSubject = renderTemplate(emailTemplate.subject, vars);
      const renderedBody = renderTemplate(emailTemplate.body, vars);
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: renderedSubject,
        html: renderedBody,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const platformSms = bookingConfirmedSms({
        bookingReference: booking.booking_reference,
        pickupTime: booking.pickup_at_utc,
      });
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingConfirmed',
        'sms',
        { subject: '', body: platformSms, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, booking.customer_phone, rendered);
    }
  }

  private async onDriverAccepted(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver = await this.getDriver(payload.driver_id);
    if (!booking || !driver) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    const vars = await this.buildTemplateVars(tenantId, booking, driver);

    if (emailIntegration && booking.customer_email) {
      const template = driverAcceptedEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
        driverName: driver.full_name,
        vehicleMake: '',
        vehicleModel: '',
      });
      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverAcceptedAssignment',
        'email',
        { subject: template.subject, body: template.html, source: 'PLATFORM' },
      );
      const renderedSubject = renderTemplate(emailTemplate.subject, vars);
      const renderedBody = renderTemplate(emailTemplate.body, vars);
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: renderedSubject,
        html: renderedBody,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = driverAcceptedSms({
        bookingReference: booking.booking_reference,
        driverName: driver.full_name,
      });
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverAcceptedAssignment',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, booking.customer_phone, rendered);
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
    const vars = await this.buildTemplateVars(tenantId, booking, driver);
    if (smsIntegration && driver.phone) {
      const msg = driverInvitationSms({
        bookingReference: booking.booking_reference,
        pickupAddress: booking.pickup_address,
        pickupTime: booking.pickup_at_utc,
      });
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverInvitationSent',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, driver.phone, rendered);
    }
  }

  private async onJobCompleted(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    const totalAmount = booking.total_price_minor
      ? (booking.total_price_minor / 100).toFixed(2)
      : '0.00';

    const vars = await this.buildTemplateVars(tenantId, booking, undefined, totalAmount);

    if (emailIntegration && booking.customer_email) {
      const template = jobCompletedEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
        totalAmount,
        currency: booking.currency ?? 'AUD',
      });
      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'JobCompleted',
        'email',
        { subject: template.subject, body: template.html, source: 'PLATFORM' },
      );
      const renderedSubject = renderTemplate(emailTemplate.subject, vars);
      const renderedBody = renderTemplate(emailTemplate.body, vars);
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: renderedSubject,
        html: renderedBody,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = jobCompletedSms({
        bookingReference: booking.booking_reference,
      });
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'JobCompleted',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, booking.customer_phone, rendered);
    }
  }

  private async onBookingCancelled(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    const vars = await this.buildTemplateVars(tenantId, booking);

    if (emailIntegration && booking.customer_email) {
      const template = bookingCancelledEmail({
        bookingReference: booking.booking_reference,
        customerName: `${booking.customer_first_name} ${booking.customer_last_name}`,
      });
      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingCancelled',
        'email',
        { subject: template.subject, body: template.html, source: 'PLATFORM' },
      );
      const renderedSubject = renderTemplate(emailTemplate.subject, vars);
      const renderedBody = renderTemplate(emailTemplate.body, vars);
      await this.emailProvider.send(emailIntegration, {
        to: booking.customer_email,
        subject: renderedSubject,
        html: renderedBody,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && booking.customer_phone) {
      const msg = bookingCancelledSms({
        bookingReference: booking.booking_reference,
      });
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingCancelled',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, booking.customer_phone, rendered);
    }
  }

  private async onDriverRejectedAssignment(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver = await this.getDriver(payload.driver_id);
    if (!booking || !driver) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    const adminEmail = await this.getTenantOwnerEmail(tenantId);
    const vars = await this.buildTemplateVars(tenantId, booking, driver);

    if (emailIntegration && adminEmail) {
      const template = driverRejectedAdminEmail({
        bookingReference: booking.booking_reference,
        driverName: driver.full_name,
      });
      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverRejectedAssignment',
        'email',
        { subject: template.subject, body: template.html, source: 'PLATFORM' },
      );
      const renderedSubject = renderTemplate(emailTemplate.subject, vars);
      const renderedBody = renderTemplate(emailTemplate.body, vars);
      await this.emailProvider.send(emailIntegration, {
        to: adminEmail,
        subject: renderedSubject,
        html: renderedBody,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name ?? 'Chauffeur',
      });
    }

    if (smsIntegration && adminEmail) {
      const msg = driverRejectedAdminSms();
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverRejectedAssignment',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, adminEmail, rendered);
    }
  }

  private async onAssignmentCancelled(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver = await this.getDriver(payload.driver_id);
    if (!booking || !driver) return;

    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    const vars = await this.buildTemplateVars(tenantId, booking, driver);

    if (smsIntegration && driver.phone) {
      const msg = assignmentCancelledSms();
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'AssignmentCancelled',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, driver.phone, rendered);
    }
  }

  private async onDriverPayUpdated(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver = await this.getDriver(payload.driver_id);
    if (!booking || !driver) return;

    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    const vars = await this.buildTemplateVars(tenantId, booking, driver);

    if (smsIntegration && driver.phone) {
      const msg = driverPayUpdatedSms();
      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverPayUpdated',
        'sms',
        { subject: '', body: msg, source: 'PLATFORM' },
      );
      const rendered = renderTemplate(smsTemplate.body, vars);
      await this.smsProvider.send(smsIntegration, driver.phone, rendered);
    }
  }

  private async getBooking(bookingId: string) {
    const rows = await this.dataSource.query(
      `SELECT 
         id, booking_reference, tenant_id, city_id,
         customer_email,
         CONCAT(customer_phone_country_code, customer_phone_number) as customer_phone,
         customer_first_name, customer_last_name,
         pickup_address_text as pickup_address,
         dropoff_address_text as dropoff_address,
         passenger_first_name,
         passenger_last_name,
         passenger_phone_country_code,
         passenger_phone_number,
         pickup_at_utc, total_price_minor, currency
       FROM public.bookings WHERE id = $1`,
      [bookingId],
    );
    return rows[0] ?? null;
  }

  private async getDriver(driverId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, full_name, email, phone FROM public.users WHERE id = $1`,
      [driverId],
    );
    return rows[0] ?? null;
  }

  private async getTenantOwnerEmail(tenantId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT u.email
       FROM public.memberships m
       JOIN public.users u ON u.id = m.user_id
       WHERE m.tenant_id = $1 AND m.role = 'OWNER' AND m.status = 'active'
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.email ?? null;
  }

  private async buildTemplateVars(
    tenantId: string,
    booking: any,
    driver?: any,
    totalAmount?: string,
  ): Promise<TemplateVariables> {
    const pickupTime = await this.formatPickupTime(tenantId, booking.city_id, booking.pickup_at_utc);
    const passengerName = `${booking.passenger_first_name ?? ''} ${booking.passenger_last_name ?? ''}`.trim();
    const passengerPhone = `${booking.passenger_phone_country_code ?? ''}${booking.passenger_phone_number ?? ''}`;
    return {
      booking_reference: booking.booking_reference ?? '',
      customer_first_name: booking.customer_first_name ?? '',
      customer_last_name: booking.customer_last_name ?? '',
      pickup_address: booking.pickup_address ?? '',
      dropoff_address: booking.dropoff_address ?? '',
      pickup_time: pickupTime,
      driver_name: driver?.full_name ?? '',
      vehicle_make: '',
      vehicle_model: '',
      total_amount: totalAmount ?? (booking.total_price_minor ? (booking.total_price_minor / 100).toFixed(2) : ''),
      currency: booking.currency ?? 'AUD',
      passenger_name: passengerName,
      passenger_phone: passengerPhone,
    };
  }

  private async formatPickupTime(tenantId: string, cityId: string | null, pickupAtUtc: string) {
    const tz = await this.getCityTimezone(tenantId, cityId);
    const date = new Date(pickupAtUtc);
    if (!tz) {
      return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    }
    const formatted = new Intl.DateTimeFormat('en-AU', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${formatted} (${tz})`;
  }

  private async getCityTimezone(tenantId: string, cityId?: string | null): Promise<string | null> {
    if (!cityId) return null;
    const rows = await this.dataSource.query(
      `SELECT timezone FROM public.tenant_service_cities WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, cityId],
    );
    return rows[0]?.timezone ?? null;
  }
}
