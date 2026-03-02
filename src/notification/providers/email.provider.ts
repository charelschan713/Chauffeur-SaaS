import { Injectable, Logger } from '@nestjs/common';
import { ResolvedIntegration } from '../../integration/integration.resolver';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  fromAddress: string;
  fromName: string;
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);

  async send(
    integration: ResolvedIntegration,
    params: SendEmailParams,
  ): Promise<boolean> {
    if (integration.provider === 'resend') {
      return this.sendViaResend(integration.config, params);
    }
    if (integration.provider === 'sendgrid') {
      return this.sendViaSendGrid(integration.config, params);
    }
    if (integration.provider === 'mailgun') {
      return this.sendViaMailgun(integration.config, params);
    }
    this.logger.warn(`Unknown email provider: ${integration.provider}`);
    return false;
  }

  private async sendViaResend(
    config: Record<string, string>,
    params: SendEmailParams,
  ): Promise<boolean> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${params.fromName} <${params.fromAddress}>`,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error('Resend error', err as Error);
      return false;
    }
  }

  private async sendViaSendGrid(
    config: Record<string, string>,
    params: SendEmailParams,
  ): Promise<boolean> {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.fromAddress, name: params.fromName },
          subject: params.subject,
          content: [{ type: 'text/html', value: params.html }],
        }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error('SendGrid error', err as Error);
      return false;
    }
  }

  private async sendViaMailgun(
    config: Record<string, string>,
    params: SendEmailParams,
  ): Promise<boolean> {
    try {
      const domain = config.domain;
      const form = new URLSearchParams({
        from: `${params.fromName} <${params.fromAddress}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      const res = await fetch(
        `https://api.mailgun.net/v3/${domain}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${config.api_key}`).toString('base64')}`,
          },
          body: form,
        },
      );
      return res.ok;
    } catch (err) {
      this.logger.error('Mailgun error', err as Error);
      return false;
    }
  }
}
