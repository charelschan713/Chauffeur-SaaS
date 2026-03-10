/**
 * Twilio Webhook Controller
 * Receives inbound SMS from passengers replying to the Twilio proxy number.
 * Maps each reply back to the correct booking thread.
 *
 * Twilio webhook setup: configure the Twilio phone number's
 * "A MESSAGE COMES IN" webhook to:
 *   POST https://your-backend.railway.app/webhooks/twilio/sms
 *
 * Twilio signature validation is recommended for production but
 * is optional in test mode.
 */
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TripSmsService } from './trip-sms.service';

@Controller('webhooks/twilio')
export class TwilioWebhookController {
  constructor(private readonly smsSvc: TripSmsService) {}

  @Post('sms')
  @HttpCode(200)
  async handleInboundSms(
    @Body() body: {
      From?: string;
      To?: string;
      Body?: string;
      MessageSid?: string;
    },
    @Req() req: Request,
  ): Promise<string> {
    const from     = body.From ?? '';
    const to       = body.To   ?? '';
    const msgBody  = body.Body ?? '';
    const sid      = body.MessageSid;

    // Resolve tenant from X-Tenant-Id header (set by Twilio webhook URL param)
    // or fall back to lookup by Twilio number
    const tenantId = (req.headers['x-tenant-id'] as string) ?? undefined;

    await this.smsSvc.handleInboundWebhook({
      from,
      to,
      body: msgBody,
      twilioSid: sid,
      tenantId,
    });

    // Return empty TwiML — Twilio requires 200 OK with valid response
    return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  }
}
