/**
 * TripSmsService — Twilio SMS bridge for driver ↔ passenger communication
 *
 * The bridge works as follows:
 *   - Driver sends message from driver app → system sends via Twilio proxy number
 *   - Passenger receives: "Your Driver [Name]: [message]"
 *   - Passenger replies to Twilio number → webhook → mapped back to booking thread
 *   - Driver sees replies in app conversation thread
 *
 * Security:
 *   - Driver's real number is never exposed to passenger
 *   - Passenger's real number is stored only in trip_evidence_records (internal only)
 *   - Bridge opens at on_the_way; closes at job_done / fulfilled
 */
import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IntegrationResolver } from '../integration/integration.resolver';
import { TripEvidenceService } from './trip-evidence.service';

@Injectable()
export class TripSmsService {
  private readonly logger = new Logger(TripSmsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly integrationResolver: IntegrationResolver,
    private readonly evidenceSvc: TripEvidenceService,
  ) {}

  /**
   * Driver sends a message from the driver app.
   * System sends SMS to passenger via Twilio proxy number.
   */
  async driverSendMessage(params: {
    tenantId: string;
    bookingId: string;
    driverId: string;
    messageBody: string;
  }): Promise<{ sent: boolean; message: string }> {
    // Validate evidence record is active and bridge is open
    const rec = await this.evidenceSvc.getEvidenceRecord(params.tenantId, params.bookingId);
    if (!rec) {
      throw new NotFoundException('Trip evidence record not found — booking may not have started yet.');
    }
    if (rec.evidence_status === 'frozen') {
      throw new ForbiddenException('Trip is complete — conversation is closed.');
    }
    if (rec.sms_bridge_closed_at) {
      throw new ForbiddenException('SMS bridge is closed for this trip.');
    }
    if (!rec.passenger_phone) {
      throw new ForbiddenException('No passenger phone number on record for this booking.');
    }

    // Get driver name for prefix
    const driverRows = await this.dataSource.query(
      `SELECT full_name FROM public.users WHERE id = $1`,
      [params.driverId],
    );
    const driverName = driverRows[0]?.full_name ?? 'Your Driver';

    // Format message with driver identity prefix
    const body = `${driverName}: ${params.messageBody}`;

    // Get Twilio integration config
    const integration = await this.integrationResolver.resolve(params.tenantId, 'twilio');
    if (!integration?.config) {
      this.logger.warn(`No Twilio integration configured for tenant ${params.tenantId}`);
      // Still record message (bridge-pending state)
      await this.evidenceSvc.recordOutboundSms({
        tenantId: params.tenantId,
        bookingId: params.bookingId,
        driverId: params.driverId,
        fromNumber: rec.twilio_proxy_number ?? 'unset',
        toNumber: rec.passenger_phone,
        body,
        deliveryStatus: 'pending_integration',
      });
      return { sent: false, message: 'SMS stored but Twilio not configured — contact admin.' };
    }

    const config = integration.config as Record<string, string>;
    const accountSid    = config.account_sid;
    const authToken     = config.auth_token ?? config.api_key;
    const fromNumber    = rec.twilio_proxy_number ?? config.phone_number ?? config.sender ?? '';

    // Send via Twilio REST API
    let twilioSid: string | undefined;
    let deliveryStatus = 'sent';
    try {
      const form = new URLSearchParams({
        To:   rec.passenger_phone,
        From: fromNumber,
        Body: body,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
          body: form,
        },
      );
      if (res.ok) {
        const data = await res.json() as Record<string, string>;
        twilioSid = data.sid;
        deliveryStatus = 'sent';
      } else {
        const errText = await res.text();
        this.logger.error(`Twilio SMS error: ${errText}`);
        deliveryStatus = 'failed';
      }
    } catch (e) {
      this.logger.error('Twilio send exception', e as Error);
      deliveryStatus = 'failed';
    }

    // Record regardless of delivery outcome (for audit)
    await this.evidenceSvc.recordOutboundSms({
      tenantId: params.tenantId,
      bookingId: params.bookingId,
      driverId: params.driverId,
      fromNumber,
      toNumber: rec.passenger_phone,
      body,
      twilioSid,
      deliveryStatus,
    });

    return {
      sent: deliveryStatus === 'sent',
      message: deliveryStatus === 'sent' ? 'Message sent to passenger' : 'Message queued but delivery failed',
    };
  }

  /**
   * Handle inbound SMS from Twilio webhook.
   * Maps passenger reply back to the correct booking thread.
   */
  async handleInboundWebhook(params: {
    from: string;      // passenger's phone number
    to: string;        // Twilio proxy number
    body: string;
    twilioSid?: string;
    tenantId?: string; // resolved from webhook auth / Twilio number lookup
  }): Promise<void> {
    // Resolve tenant from Twilio number if not provided
    let tenantId = params.tenantId;
    if (!tenantId) {
      const row = await this.dataSource.query(
        `SELECT t.id AS tenant_id
         FROM public.tenant_integrations ti
         JOIN public.tenants t ON t.id = ti.tenant_id
         WHERE ti.integration_type = 'twilio'
           AND ti.active = true
         LIMIT 1`,
      );
      tenantId = row[0]?.tenant_id;
    }
    if (!tenantId) {
      this.logger.warn(`Inbound SMS from ${params.from} — cannot resolve tenant`);
      return;
    }

    // Find active booking for this passenger + Twilio number
    let mapping = await this.evidenceSvc.findBookingByTwilioMapping(
      tenantId, params.from, params.to,
    );
    // Fallback: just match by passenger phone
    if (!mapping) {
      mapping = await this.evidenceSvc.findActiveBookingByPassengerPhone(tenantId, params.from);
    }

    if (!mapping) {
      this.logger.warn(`Inbound SMS from ${params.from} — no active trip found`);
      return;
    }

    await this.evidenceSvc.recordInboundSms({
      tenantId,
      bookingId: mapping.bookingId,
      driverId:  mapping.driverId,
      fromNumber: params.from,
      toNumber:   params.to,
      body:       params.body,
      twilioSid:  params.twilioSid,
    });
  }
}
