import { Injectable, Logger } from '@nestjs/common';
import { ResolvedIntegration } from '../../integration/integration.resolver';

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  async send(
    integration: ResolvedIntegration,
    to: string,
    message: string,
  ): Promise<boolean> {
    this.logger.log(`Sending SMS via ${integration.provider} to ${to}`);
    if (integration.provider === 'twilio') {
      return this.sendViaTwilio(integration.config, to, message);
    }
    this.logger.warn(`Unknown SMS provider: ${integration.provider}`);
    return false;
  }

  private async sendViaTwilio(
    config: Record<string, string>,
    to: string,
    message: string,
  ): Promise<boolean> {
    try {
      const accountSid = config.account_sid;
      const authToken = config.auth_token ?? config.api_key; // support both field names

      // Use sender_id (Alpha Sender) if set, otherwise fall back to phone_number
      const fromNumber = config.phone_number ?? config.sender ?? '';
      const senderId = config.sender_id ?? null;

      // Australia doesn't support unregistered alpha sender IDs — always use phone number
      const form = new URLSearchParams({ To: to, Body: message });
      form.append('From', fromNumber || senderId || '');

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
          body: form,
        },
      );
      this.logger.log(`Twilio response status: ${res.status}`);
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Twilio error body: ${body}`);
      }
      return res.ok;
    } catch (err) {
      this.logger.error('Twilio error', err as Error);
      return false;
    }
  }
}
