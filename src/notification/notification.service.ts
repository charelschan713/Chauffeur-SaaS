import { Injectable, Logger } from '@nestjs/common';
import { toE164 } from '../common/phone.util';
import { DataSource } from 'typeorm';
import { IntegrationResolver } from '../integration/integration.resolver';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { TemplateResolver } from './template.resolver';
import { renderTemplate } from './template.renderer';
import { TemplateVariables } from './notification.types';
import {
  ascBookingConfirmedEmail,
  ascBookingCancelledEmail,
  ascDriverAcceptedEmail,
  ascJobCompletedEmail,
  ascPaymentLinkEmail,
  ascFulfilledWithExtrasEmail,
} from './templates/asc-brand';

const ASC_TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
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
      case 'DriverInviteSms':
        await this.onDriverInviteSms(payload);
        break;
      case 'DriverInviteEmail':
        await this.onDriverInviteEmail(tenantId, payload);
        break;
      case 'JobCompleted':
        await this.onJobCompleted(tenantId, payload);
        break;
      case 'JobFulfilledWithExtras':
        await this.onJobFulfilledWithExtras(tenantId, payload);
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

    const templateVars = this.buildTemplateVariables(booking);

    if (emailIntegration) {
      const platformTemplate = bookingConfirmedEmail({
        bookingReference: booking.booking_reference,
        customerName: booking.customer_first_name,
        pickupAddress: booking.pickup_address_text,
        dropoffAddress: booking.dropoff_address_text,
        pickupTime: booking.pickup_time_local,
      });

      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingConfirmed',
        'email',
      );

      const subject = renderTemplate(
        emailTemplate.subject || platformTemplate.subject,
        templateVars,
      );
      const body = renderTemplate(emailTemplate.body || platformTemplate.html, templateVars);

      await this.sendEmailWithLog(tenantId, 'BookingConfirmed', emailIntegration, {
        to: booking.customer_email,
        subject,
        html: body,
        fromAddress: emailIntegration.config.from_address,
        fromName: emailIntegration.config.from_name,
      }, booking.id, templateVars as Record<string,string>).catch(() => {});
    }

    if (smsIntegration) {
      const platformBody = bookingConfirmedSms({
        bookingReference: booking.booking_reference,
        pickupTime: booking.pickup_time_local,
      });

      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingConfirmed',
        'sms',
      );

      const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

      const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
      if (customerPhone) await this.sendSmsWithLog(tenantId, 'BookingConfirmed', smsIntegration, customerPhone, body, booking.id).catch(() => {});
    }
  }

  private async onDriverAccepted(tenantId: string, payload: any) {
    const eventType = 'DriverAcceptedAssignment';
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const driver = await this.getDriver(payload.driver_id);
    if (!driver) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    const templateVars = this.buildTemplateVariables(booking, driver);

    if (emailIntegration) {
      const platformTemplate = driverAcceptedEmail({
        bookingReference: booking.booking_reference,
        customerName: booking.customer_first_name,
        driverName: driver.full_name,
        vehicleMake: booking.vehicle_make,
        vehicleModel: booking.vehicle_model,
      });

      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverAcceptedAssignment',
        'email',
      );

      const subject = renderTemplate(
        emailTemplate.subject || platformTemplate.subject,
        templateVars,
      );
      const body = renderTemplate(emailTemplate.body || platformTemplate.html, templateVars);

      await this.sendEmailWithLog(tenantId, eventType, emailIntegration, { to: booking.customer_email, subject, html: body, fromAddress: emailIntegration.config.from_address, fromName: emailIntegration.config.from_name }, booking.id, templateVars as Record<string,string>).catch(() => {});
    }

    if (smsIntegration) {
      const platformBody = driverAcceptedSms({
        bookingReference: booking.booking_reference,
        driverName: driver.full_name,
      });

      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverAcceptedAssignment',
        'sms',
      );

      const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

      const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
      if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
    }
  }

  private async onDriverInvitation(tenantId: string, payload: any) {
    const eventType = 'DriverInvitationSent';
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const driver = await this.getDriver(payload.driver_id);
    if (!driver) return;

    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    if (!smsIntegration) return;

    const templateVars = this.buildTemplateVariables(booking, driver);

    const platformBody = driverInvitationSms({
      bookingReference: booking.booking_reference,
      pickupAddress: booking.pickup_address_text,
      pickupTime: booking.pickup_time_local,
    });

    const smsTemplate = await this.templateResolver.resolve(
      tenantId,
      'DriverInvitationSent',
      'sms',
    );

    const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

    const driverPhone = toE164(driver.phone_country_code, driver.phone_number);
    if (driverPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, driverPhone, body, booking.id).catch(() => {});
  }

  private async onJobCompleted(tenantId: string, payload: any) {
    const eventType = 'JobCompleted';
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

    const templateVars = this.buildTemplateVariables(booking);

    if (emailIntegration) {
      const platformTemplate = jobCompletedEmail({
        bookingReference: booking.booking_reference,
        customerName: booking.customer_first_name,
        totalAmount: booking.total_amount,
        currency: booking.currency,
      });

      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'JobCompleted',
        'email',
      );

      const subject = renderTemplate(
        emailTemplate.subject || platformTemplate.subject,
        templateVars,
      );
      const body = renderTemplate(emailTemplate.body || platformTemplate.html, templateVars);

      await this.sendEmailWithLog(tenantId, eventType, emailIntegration, { to: booking.customer_email, subject, html: body, fromAddress: emailIntegration.config.from_address, fromName: emailIntegration.config.from_name }, booking.id, templateVars as Record<string,string>).catch(() => {});
    }

    if (smsIntegration) {
      const platformBody = jobCompletedSms({
        bookingReference: booking.booking_reference,
      });

      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'JobCompleted',
        'sms',
      );

      const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

      const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
      if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
    }
  }

  private async onJobFulfilledWithExtras(tenantId: string, payload: any) {
    const eventType = 'JobFulfilledWithExtras';
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(tenantId, 'twilio');

    // Build extra charges vars from payload
    const extrasVars: Record<string, string> = {
      waiting_time_minutes: String(payload.waiting_time_minutes ?? ''),
      waiting_time_fee:     payload.waiting_time_fee_minor   ? NotificationService.formatMinor(payload.waiting_time_fee_minor)   : '',
      extra_toll:           payload.actual_toll_minor         ? NotificationService.formatMinor(payload.actual_toll_minor)         : '',
      extra_parking:        payload.actual_parking_minor      ? NotificationService.formatMinor(payload.actual_parking_minor)      : '',
      adjustment_amount:    payload.adjustment_amount_minor   ? NotificationService.formatMinor(payload.adjustment_amount_minor)   : '',
      prepay_total:         payload.prepay_total_minor        ? NotificationService.formatMinor(payload.prepay_total_minor)        : '',
      actual_total:         payload.actual_total_minor        ? NotificationService.formatMinor(payload.actual_total_minor)        : '',
      already_paid:         payload.already_paid_minor        ? NotificationService.formatMinor(payload.already_paid_minor)        : '0',
      charged_at:           payload.charged_at                 ?? '',
    };

    const templateVars = { ...this.buildTemplateVariables(booking), ...extrasVars } as Record<string, string>;

    if (emailIntegration && booking.customer_email) {
      const subject = `Final Invoice — Additional Charges | ${booking.booking_reference}`;
      await this.sendEmailWithLog(
        tenantId, eventType, emailIntegration,
        { to: booking.customer_email, subject, html: '', fromAddress: emailIntegration.config.from_address, fromName: emailIntegration.config.from_name },
        booking.id, templateVars,
      ).catch(() => {});
    }

    if (smsIntegration) {
      const cur = booking.currency || 'AUD';
      const balanceDue = extrasVars.balance_due || extrasVars.actual_total;
      const body = `ASChauffeured: Trip ${booking.booking_reference} completed. Additional charges of ${cur} ${extrasVars.actual_total || balanceDue} have been charged to your saved card.`;
      const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
      if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
    }
  }

  private async onBookingCancelled(tenantId: string, payload: any) {
    const eventType = 'BookingCancelled';
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

    const templateVars = this.buildTemplateVariables(booking);

    if (emailIntegration) {
      const platformTemplate = bookingCancelledEmail({
        bookingReference: booking.booking_reference,
        customerName: booking.customer_first_name,
      });

      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingCancelled',
        'email',
      );

      const subject = renderTemplate(
        emailTemplate.subject || platformTemplate.subject,
        templateVars,
      );
      const body = renderTemplate(emailTemplate.body || platformTemplate.html, templateVars);

      await this.sendEmailWithLog(tenantId, eventType, emailIntegration, { to: booking.customer_email, subject, html: body, fromAddress: emailIntegration.config.from_address, fromName: emailIntegration.config.from_name }, booking.id, templateVars as Record<string,string>).catch(() => {});
    }

    if (smsIntegration) {
      const platformBody = bookingCancelledSms({
        bookingReference: booking.booking_reference,
      });

      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'BookingCancelled',
        'sms',
      );

      const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

      const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
      if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
    }
  }

  private async onDriverRejectedAssignment(tenantId: string, payload: any) {
    const eventType = 'DriverRejectedAssignment';
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const driver = await this.getDriver(payload.driver_id);
    if (!driver) return;

    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );

    const templateVars = this.buildTemplateVariables(booking, driver);

    if (emailIntegration) {
      const platformTemplate = driverRejectedAdminEmail({
        bookingReference: booking.booking_reference,
        driverName: driver.full_name,
      });

      const emailTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverRejectedAssignment',
        'email',
      );

      const subject = renderTemplate(
        emailTemplate.subject || platformTemplate.subject,
        templateVars,
      );
      const body = renderTemplate(emailTemplate.body || platformTemplate.html, templateVars);

      await this.sendEmailWithLog(tenantId, eventType, emailIntegration, { to: booking.customer_email, subject, html: body, fromAddress: emailIntegration.config.from_address, fromName: emailIntegration.config.from_name }, booking.id, templateVars as Record<string,string>).catch(() => {});
    }

    if (smsIntegration) {
      const platformBody = driverRejectedAdminSms();

      const smsTemplate = await this.templateResolver.resolve(
        tenantId,
        'DriverRejectedAssignment',
        'sms',
      );

      const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

      const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
      if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
    }
  }

  private async onAssignmentCancelled(tenantId: string, payload: any) {
    const eventType = 'AssignmentCancelled';
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    if (!smsIntegration) return;

    const templateVars = this.buildTemplateVariables(booking);

    const platformBody = assignmentCancelledSms();

    const smsTemplate = await this.templateResolver.resolve(
      tenantId,
      'AssignmentCancelled',
      'sms',
    );

    const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

    const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
    if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
  }

  private async onDriverPayUpdated(tenantId: string, payload: any) {
    const eventType = 'DriverPayUpdated';
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    const smsIntegration = await this.integrationResolver.resolve(
      tenantId,
      'twilio',
    );
    if (!smsIntegration) return;

    const templateVars = this.buildTemplateVariables(booking);

    const platformBody = driverPayUpdatedSms();

    const smsTemplate = await this.templateResolver.resolve(
      tenantId,
      'DriverPayUpdated',
      'sms',
    );

    const body = renderTemplate(smsTemplate.body || platformBody, templateVars);

    const customerPhone = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
    if (customerPhone) await this.sendSmsWithLog(tenantId, eventType, smsIntegration, customerPhone, body, booking.id).catch(() => {});
  }

  private static formatMinor(minor: number): string {
    return (minor / 100).toFixed(2);
  }

  /** Returns branded HTML for ASC tenant, null otherwise (fallback to plain template) */
  private ascBrandedHtml(
    tenantId: string,
    eventType: string,
    vars: Record<string, string>,
  ): string | null {
    if (tenantId !== ASC_TENANT_ID) return null;
    switch (eventType) {
      case 'BookingConfirmed':        return ascBookingConfirmedEmail(vars);
      case 'BookingCancelled':        return ascBookingCancelledEmail(vars);
      case 'DriverAcceptedAssignment':return ascDriverAcceptedEmail(vars);
      case 'JobCompleted':            return ascJobCompletedEmail(vars);
      case 'PaymentLinkSent':          return ascPaymentLinkEmail(vars);
      case 'JobFulfilledWithExtras':   return ascFulfilledWithExtrasEmail(vars);
      default:                         return null;
    }
  }

  private buildTemplateVariables(booking: any, driver?: any, assignment?: any): TemplateVariables {
    const currency = booking.currency ?? 'AUD';
    const snapshot = booking.pricing_snapshot ?? {};

    const waypointAddrs: string[] = (booking.waypoints ?? [])
      .map((w: any) => (typeof w === 'string' ? w : (w.address ?? w.name ?? '')))
      .filter(Boolean);
    const waypointsStr = waypointAddrs.map((addr, i) => `Stop ${i + 1}: ${addr}`).join('\n');

    const vars: TemplateVariables = {
      booking_reference: booking.booking_reference,
      customer_first_name: booking.customer_first_name ?? '',
      customer_last_name: booking.customer_last_name ?? '',
      customer_name: `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim(),
      pickup_address: booking.pickup_address_text,
      dropoff_address: booking.dropoff_address_text,
      pickup_time: booking.pickup_time_local ?? (booking.pickup_at_utc
        ? new Date(booking.pickup_at_utc).toLocaleString('en-AU', { timeZone: booking.timezone ?? 'Australia/Sydney' })
        : ''),
      waypoints: waypointsStr,
      waypoint_count: waypointAddrs.length,
      passenger_count: booking.passenger_count,
      luggage_count: booking.luggage_count,
      special_requests: booking.special_requests ?? '',
      flight_number: booking.flight_number ?? '',
      currency,
      base_fare: NotificationService.formatMinor(snapshot.subtotalMinor ?? snapshot.totalPriceMinor ?? 0),
      toll_parking_total: NotificationService.formatMinor(snapshot.toll_parking_minor ?? 0),
      total_amount: booking.total_amount ?? NotificationService.formatMinor(booking.total_price_minor ?? 0),
      driver_name: driver?.full_name ?? driver?.name ?? '',
      vehicle_make: booking.vehicle_make ?? '',
      vehicle_model: booking.vehicle_model ?? '',
      vehicle_plate: booking.vehicle_plate ?? '',
      vehicle_colour: booking.vehicle_colour ?? '',
      passenger_name: booking.passenger_name ?? [booking.passenger_first_name, booking.passenger_last_name].filter(Boolean).join(' '),
      passenger_phone: toE164(booking.passenger_phone_country_code, booking.passenger_phone_number) ?? undefined,
    };

    // Waypoint slots
    waypointAddrs.forEach((addr, i) => {
      if (i < 5) vars[`waypoint_${i + 1}`] = addr;
    });

    // Assignment / driver pay
    if (assignment) {
      vars.driver_pay_amount = NotificationService.formatMinor(assignment.driver_pay_minor ?? 0);
      vars.driver_toll_parking = NotificationService.formatMinor(assignment.toll_parking_minor ?? 0);
      vars.driver_total = NotificationService.formatMinor(
        (assignment.driver_pay_minor ?? 0) + (assignment.toll_parking_minor ?? 0),
      );
    }

    return vars;
  }

  private async logNotification(params: {
    tenantId: string;
    eventType: string;
    channel: 'email' | 'sms';
    recipientType?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    subject?: string;
    body?: string;
    status: 'SENT' | 'FAILED';
    errorMessage?: string;
    bookingId?: string;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO public.notification_log
       (tenant_id, event_type, channel, recipient_type, recipient_email, recipient_phone,
        subject, body, status, error_message, booking_id, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`,
      [
        params.tenantId,
        params.eventType,
        params.channel,
        params.recipientType ?? null,
        params.recipientEmail ?? null,
        params.recipientPhone ?? null,
        params.subject ?? null,
        params.body ?? null,
        params.status,
        params.errorMessage ?? null,
        params.bookingId ?? null,
      ],
    ).catch((err) => this.logger.warn(`notification_log insert failed: ${err?.message}`));
  }

  private async sendEmailWithLog(
    tenantId: string,
    eventType: string,
    integration: any,
    opts: { to: string; subject: string; html: string; fromAddress?: string; fromName?: string },
    bookingId?: string,
    templateVars?: Record<string, string>,
  ): Promise<void> {
    // Apply ASC branded HTML if applicable
    const brandedHtml = templateVars
      ? this.ascBrandedHtml(tenantId, eventType, templateVars)
      : null;
    const finalOpts = brandedHtml ? { ...opts, html: brandedHtml } : opts;
    try {
      await this.emailProvider.send(integration, finalOpts);
      await this.logNotification({
        tenantId, eventType, channel: 'email', recipientEmail: finalOpts.to,
        subject: finalOpts.subject, body: finalOpts.html, status: 'SENT', bookingId,
      });
    } catch (err: any) {
      await this.logNotification({
        tenantId, eventType, channel: 'email', recipientEmail: finalOpts.to,
        subject: finalOpts.subject, body: finalOpts.html, status: 'FAILED',
        errorMessage: err?.message, bookingId,
      });
      throw err;
    }
  }

  private async sendSmsWithLog(
    tenantId: string,
    eventType: string,
    integration: any,
    phone: string,
    body: string,
    bookingId?: string,
  ): Promise<void> {
    try {
      await this.smsProvider.send(integration, phone, body);
      await this.logNotification({
        tenantId, eventType, channel: 'sms', recipientPhone: phone,
        body, status: 'SENT', bookingId,
      });
    } catch (err: any) {
      await this.logNotification({
        tenantId, eventType, channel: 'sms', recipientPhone: phone,
        body, status: 'FAILED', errorMessage: err?.message, bookingId,
      });
      throw err;
    }
  }

  private async getBooking(id: string) {
    const rows = await this.dataSource.query(
      `SELECT
          b.id,
          b.booking_reference,
          b.pickup_address_text,
          b.dropoff_address_text,
          b.pickup_time_local,
          b.customer_first_name,
          b.customer_last_name,
          b.customer_email,
          b.customer_phone_country_code,
          b.customer_phone_number,
          b.currency,
          b.total_amount,
          b.passenger_name,
          b.passenger_phone_country_code,
          b.passenger_phone_number,
          v.make as vehicle_make,
          v.model as vehicle_model
       FROM public.bookings b
       LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
       WHERE b.id = $1
       LIMIT 1`,
      [id],
    );
    return rows[0];
  }

  private async getDriver(id: string) {
    const rows = await this.dataSource.query(
      `SELECT id, full_name, phone FROM public.users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0];
  }

  /** SMS invite to driver */
  private async onDriverInviteSms(payload: any) {
    const smsIntegration = await this.integrationResolver.resolve(
      payload.tenant_id, 'twilio',
    );
    if (!smsIntegration) return;
    const body = `Hi ${payload.name}, ${payload.company_name} has invited you to join as a driver. Complete your registration here: ${payload.onboard_url}`;
    await this.smsProvider.send(smsIntegration, payload.phone, body);
  }

  /** Email invite to driver */
  private async onDriverInviteEmail(tenantId: string, payload: any) {
    const emailIntegration =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    if (!emailIntegration) return;
    const html = `
      <h2>You're invited to join ${payload.company_name}</h2>
      <p>Hi ${payload.name},</p>
      <p>${payload.company_name} has invited you to register as a ${payload.invite_type === 'EXTERNAL' ? 'partner' : ''} driver on their platform.</p>
      <p><a href="${payload.onboard_url}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Complete Registration →</a></p>
      <p style="color:#6b7280;font-size:12px">This link expires in 7 days.</p>
    `;
    await this.emailProvider.send(emailIntegration, {
      to: payload.to_email,
      subject: `${payload.company_name} — Driver Registration Invite`,
      html,
      fromAddress: emailIntegration.config.from_address,
      fromName: emailIntegration.config.from_name,
    });
  }
}
