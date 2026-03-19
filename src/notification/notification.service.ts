import { Injectable, Logger } from '@nestjs/common';
import { toE164 } from '../common/phone.util';
import { DataSource } from 'typeorm';
import { IntegrationResolver } from '../integration/integration.resolver';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { TemplateResolver } from './template.resolver';
import { InvoicePdfService } from '../invoice/invoice-pdf.service';
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
    private readonly invoicePdf: InvoicePdfService,
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
      case 'CustomerInvitation':   await this.onCustomerInvitation(tenantId, payload); break;
      case 'CustomerRegistered':   await this.onCustomerRegistered(tenantId, payload); break;
      case 'CustomerEmailVerification': await this.onCustomerEmailVerification(tenantId, payload); break;
      case 'CustomerForgotPassword': await this.onForgotPassword(tenantId, payload); break;
      case 'CustomerOtp':          await this.onCustomerOtp(payload); break;
      case 'TripStarted':          await this.onTripStarted(tenantId, payload); break;
      case 'DriverArrived':        await this.onDriverArrived(tenantId, payload); break;
      case 'RefundIssued':         await this.onRefundIssued(tenantId, payload); break;
      case 'InvoiceSent':          await this.onInvoiceSent(tenantId, payload); break;
      case 'InvoiceOverdue':       await this.onInvoiceOverdue(tenantId, payload); break;
      case 'PaymentSuccess':       await this.onPaymentSuccess(tenantId, payload); break;
      case 'PaymentFailed':        await this.onPaymentFailed(tenantId, payload); break;
      case 'PaymentRequest':       await this.onPaymentRequest(tenantId, payload); break;
      case 'DriverNewDispatch':    await this.onDriverNewDispatch(tenantId, payload); break;
      case 'DriverDocExpiry30':    await this.onDriverDocExpiry(tenantId, payload, 30); break;
      case 'DriverDocExpiry7':     await this.onDriverDocExpiry(tenantId, payload, 7); break;
      case 'DriverAccountSuspended': await this.onDriverAccountSuspended(tenantId, payload); break;
      case 'DriverDocApproved':    await this.onDriverDocResult(tenantId, payload, true); break;
      case 'DriverDocRejected':    await this.onDriverDocResult(tenantId, payload, false); break;
      case 'AdminNewBooking':      await this.onAdminNewBooking(tenantId, payload); break;
      case 'AdminBookingPendingConfirm': await this.onAdminBookingPendingConfirm(tenantId, payload); break;
      case 'AdminBookingConfirmedPaid':  await this.onAdminBookingConfirmedPaid(tenantId, payload); break;
      case 'AdminDriverRejected':  await this.onAdminDriverRejected(tenantId, payload); break;
      case 'AdminPartnerRejected': await this.onAdminPartnerRejected(tenantId, payload); break;
      case 'AdminTransferRequest': await this.onAdminTransferRequest(tenantId, payload); break;
      case 'AdminPartnerAccepted': await this.onAdminPartnerAccepted(tenantId, payload); break;
      case 'AdminCollabRequest':   await this.onAdminCollabRequest(tenantId, payload); break;
      case 'AdminCollabApproved':  await this.onAdminCollabApproved(tenantId, payload); break;
      case 'AdminDriverReview':    await this.onAdminDriverReview(tenantId, payload); break;
      case 'AdminInvoicePaid':     await this.onAdminInvoicePaid(tenantId, payload); break;
      case 'AdminPaymentFailed':   await this.onAdminPaymentFailed(tenantId, payload); break;
      case 'AdminSettlement':      await this.onAdminSettlement(tenantId, payload); break;
      case 'SuperAdminDriverReview': await this.onSuperAdminDriverReview(payload); break;
      case 'SuperAdminCollabReview': await this.onSuperAdminCollabReview(payload); break;
      case 'SuperAdminNewTenant':  await this.onSuperAdminNewTenant(payload); break;
      // New canonical event names
      case 'AdminCreatedPaymentRequest':     await this.onPaymentRequest(tenantId, payload); break;
      case 'CustomerCreatedBookingReceived': await this.onBookingReceived(tenantId, payload); break;
      case 'AdminNewBookingAlert':           await this.onAdminNewBooking(tenantId, payload); break;
      case 'BookingConfirmedCustomer':       await this.onBookingConfirmed(tenantId, payload); break;
      case 'BookingRejected':               await this.onBookingRejected(tenantId, payload); break;
      case 'BookingModifiedCustomer':        await this.onBookingModified(tenantId, payload); break;
      case 'BookingModificationRequestAdmin':await this.onModificationRequest(tenantId, payload); break;
      case 'BookingReceived':               await this.onBookingReceived(tenantId, payload); break;
      case 'BookingModified':               await this.onBookingModified(tenantId, payload); break;
      case 'ModificationRequest':           await this.onModificationRequest(tenantId, payload); break;
      case 'AdditionalCharge':              await this.onAdditionalCharge(tenantId, payload); break;
      case 'AdjustmentFailed':              await this.onAdjustmentFailed(tenantId, payload); break;
      case 'AdjustmentFailedAdmin':         await this.onAdjustmentFailed(tenantId, payload); break;
      case 'JobFulfilled':                  await this.onJobFulfilledWithExtras(tenantId, payload); break;
      case 'PaymentFailedCustomer':         await this.onPaymentFailed(tenantId, payload); break;
      case 'PaymentFailedAdmin':            await this.onAdminPaymentFailed(tenantId, payload); break;
      case 'InvoicePaidAdmin':              await this.onAdminInvoicePaid(tenantId, payload); break;
      case 'DriverJobAssigned':             await this.onDriverInvitation(tenantId, payload); break;
      case 'DriverJobCancelled':            await this.onAssignmentCancelled(tenantId, payload); break;
      case 'DriverEnRoute':                 await this.onDriverEnRoute(tenantId, payload); break;
      case 'AdminConnectionApproved':       await this.onAdminCollabApproved(tenantId, payload); break;
      case 'AdminTransferReceived':         await this.onAdminTransferRequest(tenantId, payload); break;
      case 'PlatformNewDriverReview':       await this.onSuperAdminDriverReview(payload); break;
      case 'PlatformNewConnectionReview':   await this.onSuperAdminCollabReview(payload); break;
      case 'PlatformNewTenant':             await this.onSuperAdminNewTenant(payload); break;
    }
  }

  private async onBookingConfirmed(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) { console.error(`[BookingConfirmed] booking not found: ${payload.booking_id}`); return; }

    const vars = {
      ...this.buildTemplateVariables(booking) as Record<string, string>,
      // SMS goes to PASSENGER (not necessarily the booker)
      passenger_name: booking.passenger_name ?? `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim(),
    };

    console.log(`[BookingConfirmed] booking=${booking.booking_reference} to=${booking.customer_email}`);

    // Email → customer
    await this.sendBoth(tenantId, 'BookingConfirmed', vars, booking.customer_email, null, booking.id).catch(() => {});

    // SMS → passenger phone
    const smsIntegration = await this.integrationResolver.resolve(tenantId, 'twilio');
    if (smsIntegration) {
      const passengerPhone = toE164(booking.passenger_phone_country_code ?? booking.customer_phone_country_code, booking.passenger_phone_number ?? booking.customer_phone_number);
      if (passengerPhone) {
        await this.sendFromTemplate(tenantId, 'BookingConfirmed', 'sms', vars, passengerPhone, booking.id).catch(() => {});
      }
    }

    // Also notify admins (email only)
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate(tenantId, 'AdminNewBooking', 'email', vars, admin.email, booking.id).catch(() => {});
    }
  }

  private async onDriverAccepted(tenantId: string, payload: any) {
    // DriverAcceptedAssignment — internal only, no customer/passenger notification needed
    // Admin can see driver status in booking detail page
    console.log(`[DriverAcceptedAssignment] driver accepted booking ${payload.booking_id} — no notification sent (internal)`);
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
    // Compute toll/parking deltas (actual - prepay) — only show if > 0
    const tollDeltaMinor    = Math.max(0, (payload.actual_toll_minor    ?? 0) - (payload.prepay_toll_minor    ?? 0));
    const parkingDeltaMinor = Math.max(0, (payload.actual_parking_minor ?? 0) - (payload.prepay_parking_minor ?? 0));

    const extrasVars: Record<string, string> = {
      // Prepay breakdown
      prepay_total:         payload.prepay_total_minor        ? NotificationService.formatMinor(payload.prepay_total_minor)        : '',
      prepay_base_fare:     payload.prepay_base_fare_minor    ? NotificationService.formatMinor(payload.prepay_base_fare_minor)    : '',
      prepay_toll:          payload.prepay_toll_minor         ? NotificationService.formatMinor(payload.prepay_toll_minor)         : '',
      prepay_parking:       payload.prepay_parking_minor      ? NotificationService.formatMinor(payload.prepay_parking_minor)      : '',
      prepay_waypoints:     payload.prepay_waypoints_minor    ? NotificationService.formatMinor(payload.prepay_waypoints_minor)    : '',
      // Extra delta only
      waiting_time_minutes: String(payload.waiting_time_minutes ?? ''),
      waiting_time_fee:     payload.waiting_time_fee_minor    ? NotificationService.formatMinor(payload.waiting_time_fee_minor)    : '',
      toll_delta:           tollDeltaMinor    > 0             ? NotificationService.formatMinor(tollDeltaMinor)                    : '',
      parking_delta:        parkingDeltaMinor > 0             ? NotificationService.formatMinor(parkingDeltaMinor)                 : '',
      adjustment_amount:    payload.adjustment_amount_minor   ? NotificationService.formatMinor(payload.adjustment_amount_minor)   : '',
      // Actual trip details
      actual_distance_km:       payload.actual_distance_km        ? String(payload.actual_distance_km)                                   : '',
      actual_duration_minutes:  payload.actual_duration_minutes   ? String(payload.actual_duration_minutes)                              : '',
      actual_toll_amount:       payload.actual_toll_minor         ? NotificationService.formatMinor(payload.actual_toll_minor)           : '',
      actual_parking_amount:    payload.actual_parking_minor      ? NotificationService.formatMinor(payload.actual_parking_minor)        : '',
      // Totals
      actual_total:             payload.actual_total_minor        ? NotificationService.formatMinor(payload.actual_total_minor)          : '',
      balance_due:              payload.balance_due_minor         ? NotificationService.formatMinor(payload.balance_due_minor)           : '',
      // Card info
      charged_at:               payload.charged_at               ?? '',
      card_last4:               payload.card_last4               ?? '',
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
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;

    // Determine who cancelled for subject line
    const cancelledBy: string = payload.cancelled_by ?? 'admin'; // 'customer' | 'admin'
    const cancelledByLabel = cancelledBy === 'customer' ? 'by Customer ' : 'by Admin ';
    const reason: string = payload.reason ?? '';

    const vars: Record<string, string> = {
      ...this.buildTemplateVariables(booking) as Record<string, string>,
      passenger_name: booking.passenger_name ?? `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim(),
      cancelled_by_label: cancelledByLabel,
      cancellation_reason_line: reason ? ` — Reason: ${reason}` : '',
      cancellation_reason: reason,
    };

    // Email → customer
    await this.sendBoth(tenantId, 'BookingCancelled', vars, booking.customer_email, null, booking.id).catch(() => {});

    // SMS → passenger
    const smsIntegration = await this.integrationResolver.resolve(tenantId, 'twilio');
    if (smsIntegration) {
      const passengerPhone = toE164(
        booking.passenger_phone_country_code ?? booking.customer_phone_country_code,
        booking.passenger_phone_number ?? booking.customer_phone_number,
      );
      if (passengerPhone) {
        await this.sendFromTemplate(tenantId, 'BookingCancelled', 'sms', vars, passengerPhone, booking.id).catch(() => {});
      }
    }

    // Email → all admins
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate(tenantId, 'BookingCancelled', 'email', vars, admin.email, booking.id).catch(() => {});
    }
  }

  private async onDriverRejectedAssignment(tenantId: string, payload: any) {
    // Send to ADMIN ONLY — customer does not need to know about internal reassignment
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const driver = await this.getDriver(payload.driver_id);
    const vars = {
      ...this.buildTemplateVariables(booking, driver ?? undefined) as Record<string, string>,
      driver_name: driver?.full_name ?? payload.driver_name ?? 'Driver',
    };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminDriverRejected', vars, admin.email, null, booking.id).catch(() => {});
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

  private static formatMinor(minor: number | string | null | undefined): string {
    const n = Number(minor);
    if (!minor || isNaN(n)) return '0.00';
    return (n / 100).toFixed(2);
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
      customer_email: booking.customer_email ?? '',
      customer_phone: toE164(booking.customer_phone_country_code, booking.customer_phone_number) ?? '',
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
      car_type_name: booking.car_type_name ?? booking.vehicle_make ?? '',
      base_fare: NotificationService.formatMinor(
        snapshot.pre_discount_fare_minor
          ?? snapshot.base_calculated_minor
          ?? snapshot.subtotalMinor
          ?? snapshot.base_price_minor
          ?? snapshot.totalPriceMinor
          ?? booking.total_price_minor
          ?? 0,
      ),
      toll_parking_total: NotificationService.formatMinor((snapshot.toll_minor ?? 0) + (snapshot.parking_minor ?? 0) + (snapshot.toll_parking_minor ?? 0)),
      extras_amount: NotificationService.formatMinor((snapshot.extras_minor ?? 0) + (snapshot.baby_seats_minor ?? 0) + (snapshot.waypoints_minor ?? 0)),
      total_amount: NotificationService.formatMinor(booking.total_price_minor ?? 0),
      total_price:  NotificationService.formatMinor(booking.total_price_minor ?? 0), // alias for custom templates
      // Discount breakdown (non-empty only when discount applied)
      discount_amount: NotificationService.formatMinor(booking.discount_total_minor ?? 0),
      has_discount:    Number(booking.discount_total_minor) > 0 ? 'true' : '',
      original_price:  Number(booking.discount_total_minor) > 0
        ? NotificationService.formatMinor((Number(booking.total_price_minor) + Number(booking.discount_total_minor)))
        : '',
      city:         booking.city_name ?? booking.city ?? '',
      // Adjustment / Part A + B (set by caller via payload merge)
      prepay_amount: '',
      actual_amount: '',
      actual_base_fare: '',
      actual_toll_parking: '',
      waiting_time_fee: '',
      adjustment_amount: '',
      refund_amount: '',
      total_paid: NotificationService.formatMinor(booking.total_price_minor ?? 0),
      // Payment
      card_brand: '',
      card_last4: '',
      // URLs — resolved from tenant config or default
      payment_url: '',
      admin_booking_url: `https://chauffeur-saa-s.vercel.app/bookings/${booking.id ?? ''}`,
      pay_url: '',
      booking_url: 'https://aschauffeured.chauffeurssolution.com/quote',
      reset_url: '',
      // Modification
      modification_details: '',
      // Rejection
      rejection_reason: '',
      // Cancellation
      cancelled_by_label: '',
      cancellation_reason_line: '',
      cancellation_reason: '',
      // Driver
      driver_name: driver?.full_name ?? driver?.name ?? '',
      vehicle_make: booking.vehicle_make ?? '',
      vehicle_model: booking.vehicle_model ?? '',
      vehicle_plate: booking.vehicle_plate ?? '',
      vehicle_colour: booking.vehicle_colour ?? '',
      eta_minutes: '',
      // Passenger
      passenger_name: booking.passenger_name ?? [booking.passenger_first_name, booking.passenger_last_name].filter(Boolean).join(' '),
      passenger_phone: toE164(booking.passenger_phone_country_code, booking.passenger_phone_number) ?? undefined,
      // Invoice
      invoice_number: '',
      due_date: '',
      amount: '',
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
    opts: { to: string; subject: string; html: string; fromAddress?: string | null; fromName?: string | null; attachments?: import('./providers/email.provider').EmailAttachment[] },
    bookingId?: string,
    templateVars?: Record<string, string>,
  ): Promise<void> {
    // Apply ASC branded HTML if applicable
    const brandedHtml = templateVars
      ? this.ascBrandedHtml(tenantId, eventType, templateVars)
      : null;

    // Resolve from address — fall back to tenant branding contact_email
    let resolvedFrom = opts.fromAddress || integration.config?.from_address;
    let resolvedFromName = opts.fromName || integration.config?.from_name;
    if (!resolvedFrom) {
      const [branding] = await this.dataSource.query(
        `SELECT tb.contact_email, tb.company_name, t.name
           FROM public.tenant_branding tb
           JOIN public.tenants t ON t.id = tb.tenant_id
          WHERE tb.tenant_id = $1 LIMIT 1`,
        [tenantId],
      ).catch(() => []);
      resolvedFrom = branding?.contact_email ?? 'noreply@aschauffeured.com.au';
      resolvedFromName = resolvedFromName ?? branding?.company_name ?? branding?.name ?? 'ASChauffeured';
    }

    const finalOpts = {
      ...(brandedHtml ? { ...opts, html: brandedHtml } : opts),
      fromAddress: resolvedFrom,
      fromName: resolvedFromName,
    };
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
          b.tenant_id,
          b.booking_reference,
          b.pickup_address_text,
          b.dropoff_address_text,
          b.pickup_at_utc,
          b.timezone,
          b.customer_first_name,
          b.customer_last_name,
          b.customer_email,
          b.customer_phone_country_code,
          b.customer_phone_number,
          b.currency,
          b.total_price_minor,
          b.discount_total_minor,
          b.passenger_count,
          b.luggage_count,
          b.special_requests,
          b.pricing_snapshot,
          b.service_class_id,
          COALESCE(b.waypoints, '{}') AS waypoints,
          sc.name AS car_type_name,
          sc.name AS vehicle_make,
          NULL::text AS vehicle_model,
          COALESCE(b.passenger_first_name, b.customer_first_name) AS passenger_name,
          COALESCE(b.passenger_phone_country_code, b.customer_phone_country_code) AS passenger_phone_country_code,
          COALESCE(b.passenger_phone_number, b.customer_phone_number) AS passenger_phone_number,
          to_char(b.pickup_at_utc AT TIME ZONE COALESCE(b.timezone, 'UTC'), 'Dy DD Mon YYYY HH12:MI AM') AS pickup_time_local,
          c.name AS city_name
       FROM public.bookings b
       LEFT JOIN public.tenant_service_classes sc ON sc.id = b.service_class_id
       LEFT JOIN public.tenant_service_cities c ON c.id = (
         SELECT id FROM public.tenant_service_cities
         WHERE b.pickup_address_text ILIKE '%' || name || '%'
           AND tenant_id = b.tenant_id
         LIMIT 1
       )
       WHERE b.id = $1
       LIMIT 1`,
      [id],
    ).catch((e) => { console.error('[getBooking] query failed:', e?.message); return []; });
    return rows[0] ?? null;
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
    const html = `<h2>You're invited to join ${payload.company_name}</h2>
      <p>Hi ${payload.name},</p>
      <p>${payload.company_name} has invited you to register as a driver.</p>
      <p><a href="${payload.onboard_url}">Complete Registration →</a></p>`;
    await this.emailProvider.send(emailIntegration, {
      to: payload.to_email,
      subject: `${payload.company_name} — Driver Registration Invite`,
      html,
      fromAddress: emailIntegration.config.from_address,
      fromName: emailIntegration.config.from_name,
    });
  }

  // ── Helper: resolve email+sms integrations ──────────────────────────────
  private async resolveIntegrations(tenantId: string) {
    const email =
      (await this.integrationResolver.resolve(tenantId, 'resend')) ??
      (await this.integrationResolver.resolve(tenantId, 'sendgrid')) ??
      (await this.integrationResolver.resolve(tenantId, 'mailgun'));
    const sms = await this.integrationResolver.resolve(tenantId, 'twilio');
    return { email, sms };
  }

  // ── Helper: send from template (DB-driven with {{var}} interpolation) ──
  private async sendFromTemplate(
    tenantId: string, eventType: string, channel: 'email' | 'sms',
    vars: Record<string, string>, to: string, bookingId?: string,
  ) {
    const { email, sms } = await this.resolveIntegrations(tenantId);
    const tpl = await this.templateResolver.resolve(tenantId, eventType, channel);
    if (!tpl || !tpl.active || !tpl.body) return;
    const body = renderTemplate(tpl.body, vars);
    if (channel === 'email' && email) {
      const subject = renderTemplate(tpl.subject ?? eventType, vars);
      await this.sendEmailWithLog(tenantId, eventType, email,
        { to, subject, html: body }, bookingId, vars);
    }
    if (channel === 'sms' && sms) {
      await this.sendSmsWithLog(tenantId, eventType, sms, to, body, bookingId);
    }
  }

  /**
   * Sends email + SMS, but ONLY to recipients allowed by the template's `recipients` config.
   * Pass contacts for each role; the template config decides who actually gets notified.
   */
  private async sendBoth(
    tenantId: string,
    eventType: string,
    vars: Record<string, string>,
    toEmail?: string | null,
    toPhone?: string | null,
    bookingId?: string,
    contacts?: {
      driver?: { email?: string; phone?: string };
      admin?: { email?: string; phone?: string }[];
    },
  ) {
    // Resolve recipients config from template (email channel is authoritative)
    const tplMeta = await this.templateResolver.resolve(tenantId, eventType, 'email');
    if (!tplMeta.active) return; // whole event disabled
    const recipients = tplMeta.recipients?.length ? tplMeta.recipients : ['customer'];

    const promises: Promise<any>[] = [];

    const sendTo = (email?: string | null, phone?: string | null) => {
      if (email) promises.push(this.sendFromTemplate(tenantId, eventType, 'email', vars, email, bookingId).catch(() => {}));
      if (phone) promises.push(this.sendFromTemplate(tenantId, eventType, 'sms', vars, phone, bookingId).catch(() => {}));
    };

    for (const role of recipients) {
      if (role === 'customer') sendTo(toEmail, toPhone);
      if (role === 'driver' && contacts?.driver) sendTo(contacts.driver.email, contacts.driver.phone);
      if (role === 'admin') {
        const admins = contacts?.admin ?? await this.getAdminContacts(tenantId);
        for (const a of admins) sendTo(a.email, a.phone);
      }
    }

    await Promise.all(promises);
  }

  // ── Helpers: get admin email for tenant ──────────────────────────────────
  private async getAdminContacts(tenantId: string): Promise<{ email?: string; phone?: string }[]> {
    const rows = await this.dataSource.query(
      `SELECT u.email, u.phone_number as phone
       FROM public.memberships m
       JOIN public.users u ON u.id = m.user_id
       WHERE m.tenant_id = $1 AND m.role = 'tenant_admin' AND m.status = 'active'`,
      [tenantId],
    );
    return rows;
  }

  private async getSuperAdminContacts(): Promise<{ email?: string }[]> {
    const rows = await this.dataSource.query(
      `SELECT email FROM public.users WHERE is_platform_admin = true`,
    );
    return rows;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOMER EVENTS
  // ════════════════════════════════════════════════════════════════════════════

  private async onCustomerInvitation(tenantId: string, payload: any) {
    const vars = {
      customer_first_name: payload.customer_first_name ?? '',
      customer_last_name:  payload.customer_last_name  ?? '',
      portal_url:          payload.portal_url  ?? '',
      login_url:           payload.login_url   ?? '',
    };
    const toEmail = payload.channel === 'email' ? (payload.email ?? null) : null;
    const toPhone = payload.channel === 'sms'   ? (payload.phone ?? null) : null;
    await this.sendBoth(tenantId, 'CustomerInvitation', vars, toEmail, toPhone);
  }

  private async onCustomerRegistered(tenantId: string, payload: any) {
    const vars = { customer_name: payload.first_name ?? '', email: payload.email ?? '' };
    await this.sendBoth(tenantId, 'CustomerRegistered', vars, payload.email, payload.phone);
  }

  private async onCustomerEmailVerification(tenantId: string, payload: any) {
    const vars = {
      customer_name: payload.first_name ?? '',
      otp_code: payload.otp ?? '',
    };
    await this.sendBoth(tenantId, 'CustomerEmailVerification', vars, payload.email, null);
  }

  private async onForgotPassword(tenantId: string, payload: any) {
    const vars = {
      customer_first_name: payload.customer_first_name ?? payload.name ?? '',
      customer_name: payload.name ?? '',
      reset_url: payload.reset_url ?? payload.reset_link ?? '',
      reset_link: payload.reset_link ?? payload.reset_url ?? '',
      expires: '1 hour',
    };
    await this.sendBoth(tenantId, 'CustomerForgotPassword', vars, payload.email, payload.phone);
  }

  private async onCustomerOtp(payload: any) {
    const sms = await this.integrationResolver.resolve(payload.tenant_id, 'twilio');
    if (!sms || !payload.phone) return;
    const body = `Your ASChauffeured verification code is: ${payload.otp}. Valid for 10 minutes.`;
    await this.sendSmsWithLog(payload.tenant_id, 'CustomerOtp', sms, payload.phone, body);
  }

  private async onTripStarted(tenantId: string, payload: any) {
    // SMS to PASSENGER only — no email
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      passenger_name: booking.passenger_name ?? `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim(),
    };
    const smsIntegration = await this.integrationResolver.resolve(tenantId, 'twilio');
    if (smsIntegration) {
      const passengerPhone = toE164(
        booking.passenger_phone_country_code ?? booking.customer_phone_country_code,
        booking.passenger_phone_number ?? booking.customer_phone_number,
      );
      if (passengerPhone) await this.sendFromTemplate(tenantId, 'TripStarted', 'sms', vars, passengerPhone, booking.id).catch(() => {});
    }
  }

  private async onDriverArrived(tenantId: string, payload: any) {
    // SMS to PASSENGER only — driver has arrived at pickup
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const driver = payload.driver_id ? await this.getDriver(payload.driver_id) : null;
    const vars: Record<string, string> = {
      ...this.buildTemplateVariables(booking, driver ?? undefined) as Record<string, string>,
      passenger_name: booking.passenger_name ?? `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim(),
      driver_name: driver?.full_name ?? payload.driver_name ?? 'Your driver',
      vehicle_make: booking.vehicle_make ?? driver?.vehicle_make ?? '',
      vehicle_model: booking.vehicle_model ?? driver?.vehicle_model ?? '',
      vehicle_plate: payload.vehicle_plate ?? '',
    };
    const smsIntegration = await this.integrationResolver.resolve(tenantId, 'twilio');
    if (smsIntegration) {
      const passengerPhone = toE164(
        booking.passenger_phone_country_code ?? booking.customer_phone_country_code,
        booking.passenger_phone_number ?? booking.customer_phone_number,
      );
      if (passengerPhone) await this.sendFromTemplate(tenantId, 'DriverArrived', 'sms', vars, passengerPhone, booking.id).catch(() => {});
    }
    // Push to customer
    this.sendCustomerPush(booking.customer_id, '📍 Your Chauffeur Has Arrived', `${vars['driver_name']} is waiting at the pickup point.`, { booking_id: booking.id }).catch(() => {});
  }

  private async onRefundIssued(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars = {
      ...this.bookingVars(booking),
      refund_amount: payload.refund_amount ?? '',
      refund_days: '5–10 business days',
    };
    await this.sendBoth(tenantId, 'RefundIssued', vars,
      booking.customer_email,
      booking.customer_phone_number ? `${booking.customer_phone_country_code}${booking.customer_phone_number}` : null,
      booking.id,
    );
  }

  private async onInvoiceSent(tenantId: string, payload: any) {
    const vars = {
      customer_name:  payload.customer_name  ?? '',
      invoice_number: payload.invoice_number ?? '',
      amount:         payload.amount         ?? '',
      due_date:       payload.due_date        ?? '',
      invoice_url:    payload.invoice_url    ?? '',
    };

    // ── Generate invoice PDF for attachment ─────────────────────────────────
    let pdfBuffer: Buffer | null = null;
    try {
      // Fetch branding for company name/contact
      const [branding] = await this.dataSource.query(
        `SELECT tb.company_name, tb.contact_email, tb.contact_phone
         FROM public.tenant_branding tb WHERE tb.tenant_id = $1 LIMIT 1`,
        [tenantId],
      ).catch(() => []);

      pdfBuffer = await this.invoicePdf.generate({
        invoice_number:   payload.invoice_number ?? 'INV',
        issue_date:       payload.issue_date ?? new Date(),
        due_date:         payload.due_date ?? null,
        booking_reference: payload.booking_reference ?? null,
        company_name:     branding?.company_name ?? payload.company_name ?? 'ASChauffeured',
        company_email:    branding?.contact_email ?? null,
        company_phone:    branding?.contact_phone ?? null,
        recipient_name:   payload.customer_name ?? '',
        recipient_email:  payload.customer_email ?? null,
        currency:         payload.currency ?? 'AUD',
        subtotal_minor:   Number(payload.subtotal_minor ?? 0),
        tax_minor:        Number(payload.tax_minor ?? 0),
        discount_minor:   Number(payload.discount_minor ?? 0),
        total_minor:      Number(payload.total_minor ?? payload.amount_minor ?? 0),
        line_items:       payload.line_items ?? null,
        notes:            payload.notes ?? null,
        // Trip evidence reference — query live if booking_id provided
        trip_evidence_summary: await (async () => {
          const bId = payload.booking_id;
          if (!bId) return null;
          try {
            const [rec] = await this.dataSource.query(
              `SELECT id, evidence_status, evidence_frozen_at, route_image_url FROM public.trip_evidence_records WHERE booking_id=$1 AND tenant_id=$2`,
              [bId, tenantId],
            );
            if (!rec) return null;
            const milestones = await this.dataSource.query(
              `SELECT DISTINCT milestone_type FROM public.trip_gps_milestones WHERE booking_id=$1 ORDER BY 1`,
              [bId],
            );
            const smsCnt = await this.dataSource.query(
              `SELECT COUNT(*) n FROM public.trip_sms_messages WHERE booking_id=$1`,
              [bId],
            );
            return {
              is_available:     true,
              is_frozen:        rec.evidence_status === 'frozen',
              finalized_at:     rec.evidence_frozen_at ?? null,
              milestone_types:  milestones.map((m: any) => m.milestone_type),
              has_route_image:  !!rec.route_image_url,
              has_sms:          Number(smsCnt[0]?.n ?? 0) > 0,
              message_count:    Number(smsCnt[0]?.n ?? 0),
              evidence_id:      rec.id,
            };
          } catch { return null; }
        })(),
      });
    } catch (err: any) {
      this.logger.error('[onInvoiceSent] PDF generation failed — sending email without attachment', err?.message);
      // Non-fatal: email still sends without attachment
    }

    const booking_ref = payload.booking_reference ?? payload.invoice_number ?? 'Invoice';
    const attachments = pdfBuffer
      ? [{ filename: `Invoice-${booking_ref}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [];

    // Send via template (with attachments passed inline)
    const { email: emailIntegration } = await this.resolveIntegrations(tenantId);
    if (emailIntegration && payload.customer_email) {
      const tpl = await this.templateResolver.resolve(tenantId, 'InvoiceSent', 'email');
      if (tpl?.active && tpl?.body) {
        const { renderTemplate: rt } = await import('./template.renderer');
        const html    = rt(tpl.body, vars);
        const subject = rt(tpl.subject ?? 'Your Invoice', vars);
        await this.sendEmailWithLog(
          tenantId, 'InvoiceSent', emailIntegration,
          { to: payload.customer_email, subject, html, attachments },
          payload.booking_id,
          vars,
        ).catch((e: any) => this.logger.error('[onInvoiceSent] Email send failed', e?.message));
      }
    }
    // SMS fallback (no attachment)
    await this.sendBoth(tenantId, 'InvoiceSent', vars, null, payload.customer_phone);
  }

  private async onInvoiceOverdue(tenantId: string, payload: any) {
    const vars = {
      customer_name: payload.customer_name ?? '',
      invoice_number: payload.invoice_number ?? '',
      amount: payload.amount ?? '',
      due_date: payload.due_date ?? '',
    };
    await this.sendBoth(tenantId, 'InvoiceOverdue', vars, payload.customer_email, payload.customer_phone);
  }

  private async onPaymentSuccess(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars = { ...this.bookingVars(booking), amount: payload.amount ?? '', card_last4: payload.card_last4 ?? '' };
    await this.sendBoth(tenantId, 'PaymentSuccess', vars,
      booking.customer_email,
      booking.customer_phone_number ? `${booking.customer_phone_country_code}${booking.customer_phone_number}` : null,
      booking.id,
    );
  }

  private async onPaymentFailed(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars = { ...this.bookingVars(booking), card_last4: payload.card_last4 ?? '' };
    await this.sendBoth(tenantId, 'PaymentFailed', vars,
      booking.customer_email,
      booking.customer_phone_number ? `${booking.customer_phone_country_code}${booking.customer_phone_number}` : null,
      booking.id,
    );
  }

  private async onPaymentRequest(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const rawVars = this.buildTemplateVariables(booking);
    const vars: Record<string, string> = Object.fromEntries(
      Object.entries(rawVars).map(([k, v]) => [k, v == null ? '' : String(v)])
    );
    vars.payment_link = payload.payment_link ?? payload.payment_url ?? '';
    vars.payment_url  = payload.payment_url  ?? payload.payment_link ?? '';
    // AdminCreatedPaymentRequest template has the payment link CTA
    await this.sendFromTemplate(tenantId, 'AdminCreatedPaymentRequest', 'email',
      vars, booking.customer_email, booking.id).catch(() => {});
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DRIVER EVENTS
  // ════════════════════════════════════════════════════════════════════════════

  private async onDriverNewDispatch(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    const driver  = payload.driver_id ? await this.getDriver(payload.driver_id) : null;
    if (!booking || !driver) return;
    const vars = {
      ...this.bookingVars(booking),
      driver_name: driver.full_name ?? '',
      driver_pay: payload.driver_pay ?? '',
      passenger_preferences: payload.passenger_preferences ?? '',
    };

    // 1. Email + SMS
    await this.sendBoth(tenantId, 'DriverNewDispatch', vars,
      driver.email, driver.phone, booking.id);

    // 2. Expo Push Notification
    this.sendDriverPush(
      payload.driver_id,
      '🚗 New Job',
      `${booking.booking_reference} — ${(booking as any).pickup_address_text ?? ''}`,
      { assignment_id: payload.assignment_id, booking_id: payload.booking_id },
    ).catch((e) => console.error('[Push] DriverNewDispatch failed:', e?.message));
  }

  private async sendDriverPush(
    driverId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT expo_push_token FROM users WHERE id = $1`,
      [driverId],
    );
    const token = rows[0]?.expo_push_token;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    });
  }

  private async onDriverDocExpiry(tenantId: string, payload: any, days: number) {
    const eventType = days === 7 ? 'DriverDocExpiry7' : 'DriverDocExpiry30';
    const vars = {
      driver_name: payload.driver_name ?? '',
      doc_type: payload.doc_type ?? '',
      expiry_date: payload.expiry_date ?? '',
      days_remaining: String(days),
    };
    await this.sendBoth(tenantId, eventType, vars, payload.driver_email, payload.driver_phone);
  }

  private async onDriverAccountSuspended(tenantId: string, payload: any) {
    const vars = { driver_name: payload.driver_name ?? '', doc_type: payload.doc_type ?? '' };
    await this.sendBoth(tenantId, 'DriverAccountSuspended', vars, payload.driver_email, payload.driver_phone);
  }

  private async onDriverDocResult(tenantId: string, payload: any, approved: boolean) {
    const eventType = approved ? 'DriverDocApproved' : 'DriverDocRejected';
    const vars = {
      driver_name: payload.driver_name ?? '',
      doc_type: payload.doc_type ?? '',
      reject_reason: payload.reject_reason ?? '',
    };
    await this.sendBoth(tenantId, eventType, vars, payload.driver_email, payload.driver_phone);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN EVENTS
  // ════════════════════════════════════════════════════════════════════════════

  private async onAdminNewBooking(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminNewBooking', this.bookingVars(booking),
        admin.email, null, booking.id);
    }
  }

  private async onAdminBookingPendingConfirm(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      admin_booking_url: `https://chauffeur-saa-s.vercel.app/bookings/${payload.booking_id}`,
    };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminBookingPendingConfirm', vars, admin.email, null, booking.id).catch(() => {});
    }
  }

  private async onAdminBookingConfirmedPaid(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      admin_booking_url: `https://chauffeur-saa-s.vercel.app/bookings/${payload.booking_id}`,
    };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate(tenantId, 'AdminBookingConfirmedPaid', 'email', vars, admin.email, booking.id).catch(() => {});
    }
  }

  private async onAdminDriverRejected(tenantId: string, payload: any) {
    const vars = {
      driver_name: payload.driver_name ?? '',
      booking_reference: payload.booking_reference ?? '',
      reject_reason: payload.reject_reason ?? '',
    };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminDriverRejected', vars, admin.email, null, payload.booking_id);
    }
  }

  private async onAdminPartnerRejected(tenantId: string, payload: any) {
    const vars = { partner_name: payload.partner_name ?? '', reject_reason: payload.reject_reason ?? '', booking_reference: payload.booking_reference ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminPartnerRejected', vars, admin.email, null);
    }
  }

  private async onAdminTransferRequest(tenantId: string, payload: any) {
    const vars = { source_tenant: payload.source_tenant ?? '', booking_reference: payload.booking_reference ?? '', transfer_price: payload.transfer_price ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminTransferRequest', vars, admin.email, null);
    }
  }

  private async onAdminPartnerAccepted(tenantId: string, payload: any) {
    const vars = { partner_name: payload.partner_name ?? '', booking_reference: payload.booking_reference ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminPartnerAccepted', vars, admin.email, null);
    }
  }

  private async onAdminCollabRequest(tenantId: string, payload: any) {
    const vars = { source_tenant: payload.source_tenant ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminCollabRequest', vars, admin.email, null);
    }
  }

  private async onAdminCollabApproved(tenantId: string, payload: any) {
    const vars = { partner_name: payload.partner_name ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminCollabApproved', vars, admin.email, null);
    }
  }

  private async onAdminDriverReview(tenantId: string, payload: any) {
    const vars = { driver_name: payload.driver_name ?? '', review_status: payload.review_status ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminDriverReview', vars, admin.email, null);
    }
  }

  private async onAdminInvoicePaid(tenantId: string, payload: any) {
    const vars = { invoice_number: payload.invoice_number ?? '', amount: payload.amount ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminInvoicePaid', vars, admin.email, null);
    }
  }

  private async onAdminPaymentFailed(tenantId: string, payload: any) {
    const vars = { booking_reference: payload.booking_reference ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminPaymentFailed', vars, admin.email, null);
    }
  }

  private async onAdminSettlement(tenantId: string, payload: any) {
    const vars = { booking_reference: payload.booking_reference ?? '', settlement_result: payload.settlement_result ?? '' };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      await this.sendBoth(tenantId, 'AdminSettlement', vars, admin.email, null);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN EVENTS
  // ════════════════════════════════════════════════════════════════════════════

  private async onSuperAdminDriverReview(payload: any) {
    const vars = { driver_name: payload.driver_name ?? '', tenant_name: payload.tenant_name ?? '' };
    const admins = await this.getSuperAdminContacts();
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate('platform', 'SuperAdminDriverReview', 'email', vars, admin.email).catch(() => {});
    }
  }

  private async onSuperAdminCollabReview(payload: any) {
    const vars = { tenant_a: payload.tenant_a ?? '', tenant_b: payload.tenant_b ?? '' };
    const admins = await this.getSuperAdminContacts();
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate('platform', 'SuperAdminCollabReview', 'email', vars, admin.email).catch(() => {});
    }
  }

  private async onSuperAdminNewTenant(payload: any) {
    const vars = { tenant_name: payload.tenant_name ?? '' };
    const admins = await this.getSuperAdminContacts();
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate('platform', 'SuperAdminNewTenant', 'email', vars, admin.email).catch(() => {});
    }
  }

  // ── New event handlers ───────────────────────────────────────────────────

  // Customer creates booking → email to customer (Booking Received) + email to admins (New Booking)
  private async onBookingReceived(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = this.bookingVars(booking);
    // Email → customer only ("We received your booking, pending confirmation")
    await this.sendFromTemplate(tenantId, 'CustomerCreatedBookingReceived', 'email', vars, booking.customer_email, booking.id).catch(() => {});
  }

  // Admin rejects booking → email to customer
  private async onBookingRejected(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      rejection_reason: payload.reason ?? 'No reason provided',
      booking_url: `https://aschauffeured.chauffeurssolution.com/quote`,
    };
    await this.sendBoth(tenantId, 'BookingRejected', vars, booking.customer_email, null, booking.id).catch(() => {});
  }

  // Admin modifies booking → email to customer
  private async onBookingModified(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      admin_booking_url: `https://chauffeur-saa-s.vercel.app/bookings/${payload.booking_id}`,
    };
    await this.sendBoth(tenantId, 'BookingModified', vars, booking.customer_email, null, booking.id).catch(() => {});

    // Notify assigned drivers
    const assignments = await this.dataSource.query(
      `SELECT a.id, a.assignment_type, a.partner_tenant_id, u.email as driver_email
       FROM public.assignments a
       LEFT JOIN public.users u ON u.id = a.driver_id
       WHERE a.booking_id = $1`,
      [payload.booking_id],
    ).catch(() => []);

    const driverEmails = Array.from(new Set(assignments.map((a: any) => a.driver_email).filter(Boolean)));
    for (const email of driverEmails) {
      await this.sendFromTemplate(tenantId, 'BookingModified', 'email', vars, email, booking.id).catch(() => {});
    }

    // Notify partner tenant admins (if any)
    const partnerTenantIds = Array.from(new Set(assignments
      .filter((a: any) => a.assignment_type === 'PARTNER' && a.partner_tenant_id)
      .map((a: any) => a.partner_tenant_id)));
    for (const partnerTenantId of partnerTenantIds) {
      const admins = await this.getAdminContacts(partnerTenantId).catch(() => []);
      for (const admin of admins) {
        if (admin.email) {
          await this.sendFromTemplate(partnerTenantId, 'BookingModified', 'email', vars, admin.email, booking.id).catch(() => {});
        }
      }
    }
  }

  // Customer requests modification → email to admins only
  private async onModificationRequest(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      modification_note: payload.note ?? '',
      admin_booking_url: `https://chauffeur-saa-s.vercel.app/bookings/${payload.booking_id}`,
    };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate(tenantId, 'ModificationRequest', 'email', vars, admin.email, booking.id).catch(() => {});
    }
  }

  // Part B > Part A → additional charge to customer
  private async onAdditionalCharge(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      prepay_amount: payload.prepay_amount ?? '',
      actual_amount: payload.actual_amount ?? '',
      adjustment_amount: payload.adjustment_amount ?? '',
      card_brand: payload.card_brand ?? '',
      card_last4: payload.card_last4 ?? '',
    };
    await this.sendBoth(tenantId, 'AdditionalCharge', vars, booking.customer_email, null, booking.id).catch(() => {});
  }

  // Adjustment charge failed → email to admins only
  private async onAdjustmentFailed(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const vars: Record<string, string> = {
      ...this.bookingVars(booking),
      adjustment_amount: payload.adjustment_amount ?? '',
      admin_booking_url: `https://chauffeur-saa-s.vercel.app/bookings/${payload.booking_id}`,
    };
    const admins = await this.getAdminContacts(tenantId);
    for (const admin of admins) {
      if (admin.email) await this.sendFromTemplate(tenantId, 'AdjustmentFailed', 'email', vars, admin.email, booking.id).catch(() => {});
    }
  }

  // Driver en route → SMS to passenger only
  private async onDriverEnRoute(tenantId: string, payload: any) {
    const booking = await this.getBooking(payload.booking_id);
    if (!booking) return;
    const driver = payload.driver_id ? await this.getDriver(payload.driver_id) : null;
    const vars: Record<string, string> = {
      ...this.buildTemplateVariables(booking, driver ?? undefined) as Record<string, string>,
      passenger_name: booking.passenger_name ?? `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim(),
      driver_name: driver?.full_name ?? payload.driver_name ?? 'Your driver',
      eta_minutes: payload.eta_minutes ?? '',
      vehicle_make: booking.vehicle_make ?? '',
      vehicle_model: booking.vehicle_model ?? '',
      vehicle_plate: payload.vehicle_plate ?? '',
    };
    const smsIntegration = await this.integrationResolver.resolve(tenantId, 'twilio');
    if (smsIntegration) {
      const passengerPhone = toE164(
        booking.passenger_phone_country_code ?? booking.customer_phone_country_code,
        booking.passenger_phone_number ?? booking.customer_phone_number,
      );
      if (passengerPhone) await this.sendFromTemplate(tenantId, 'DriverEnRoute', 'sms', vars, passengerPhone, booking.id).catch(() => {});
    }
    // Push to customer
    const eta = vars['eta_minutes'] ? ` ETA ${vars['eta_minutes']} mins.` : '';
    this.sendCustomerPush(booking.customer_id, '🚗 Your Chauffeur Is On The Way', `${vars['driver_name']} is heading to you.${eta}`, { booking_id: booking.id }).catch(() => {});
  }

  // ── Helper: send Expo push to customer ───────────────────────────────────
  private async sendCustomerPush(customerId: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
    if (!customerId) return;
    const rows = await this.dataSource.query(
      `SELECT expo_push_token FROM customers WHERE id = $1`,
      [customerId],
    );
    const token = rows[0]?.expo_push_token;
    if (!token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default', priority: 'high' }),
    });
  }

  // ── Helper: extract booking vars ─────────────────────────────────────────
  private bookingVars(b: any): Record<string, string> {
    // Use booking's own timezone (stored at creation time); fall back to Sydney only if missing.
    const tz = b.timezone ?? 'Australia/Sydney';
    const pickupTime = b.pickup_time_local
      ?? (b.pickup_at_utc
        ? new Date(b.pickup_at_utc).toLocaleString('en-AU', {
            timeZone: tz,
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
          })
        : '');
    const waypointList: string[] = Array.isArray(b.waypoints) ? b.waypoints.filter(Boolean) : [];
    const waypointsStr = waypointList.map((addr: string, i: number) => `Stop ${i + 1}: ${addr}`).join('\n');
    const snapshot = b.pricing_snapshot ?? {};

    return {
      booking_reference:    b.booking_reference ?? '',
      customer_first_name:  b.customer_first_name ?? '',
      customer_last_name:   b.customer_last_name ?? '',
      customer_name:        `${b.customer_first_name ?? ''} ${b.customer_last_name ?? ''}`.trim(),
      pickup_address:       b.pickup_address_text ?? b.pickup_address ?? '',
      dropoff_address:      b.dropoff_address_text ?? b.dropoff_address ?? '',
      waypoints:            waypointsStr,
      waypoint_count:       String(waypointList.length),
      pickup_time:          pickupTime,
      driver_name:          b.driver_name ?? '',
      vehicle_make:         b.vehicle_make ?? b.car_type_name ?? '',
      vehicle_model:        b.vehicle_model ?? '',
      car_type_name:        b.car_type_name ?? b.vehicle_make ?? '',
      passenger_count:      String(b.passenger_count ?? ''),
      luggage_count:        String(b.luggage_count ?? ''),
      special_requests:     b.special_requests ?? '',
      flight_number:        b.flight_number ?? '',
      base_fare:            NotificationService.formatMinor(snapshot.base_calculated_minor ?? snapshot.base_price_minor ?? 0),
      toll_parking_total:   NotificationService.formatMinor((snapshot.toll_minor ?? 0) + (snapshot.parking_minor ?? 0)),
      extras_amount:        NotificationService.formatMinor((snapshot.extras_minor ?? 0) + (snapshot.waypoints_minor ?? 0) + (snapshot.baby_seats_minor ?? 0)),
      total_price:          b.total_price_minor ? `$${(b.total_price_minor / 100).toFixed(2)}` : (b.total_amount ?? ''),
      city:                 b.city_name ?? '',
    };
  }
}
