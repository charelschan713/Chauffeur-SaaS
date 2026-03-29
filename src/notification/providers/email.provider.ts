import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ResolvedIntegration } from '../../integration/integration.resolver';

export interface EmailAttachment {
  filename:    string;
  content:     Buffer;
  contentType: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  fromAddress?:  string | null;
  fromName?:     string | null;
  cc?:           string[];
  attachments?:  EmailAttachment[];
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);

  async send(
    integration: ResolvedIntegration,
    params: SendEmailParams,
  ): Promise<boolean> {
    this.logger.log(
      `Sending email via ${integration.provider} to ${params.to}`,
    );
    if (integration.provider === 'resend') {
      return this.sendViaResend(integration.config, params);
    }
    if (integration.provider === 'smtp') {
      return this.sendViaSmtp(integration.config, params);
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
    const fromAddress = params.fromAddress?.trim();
    const fromName = params.fromName?.trim() || 'ASChauffeured';

    if (!fromAddress) {
      throw new Error('Resend failed: missing fromAddress');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [params.to],
        ...(params.cc?.length ? { cc: params.cc } : {}),
        subject: params.subject,
        html: params.html,
        ...(params.attachments?.length ? {
          attachments: params.attachments.map(a => ({
            filename:    a.filename,
            content:     a.content.toString('base64'),
            content_type: a.contentType,
          })),
        } : {}),
      }),
    });

    this.logger.log(`Resend response status: ${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Resend error body: ${body}`);
      throw new Error(`Resend failed: ${res.status} ${body}`);
    }

    return true;
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
          personalizations: [{
            to: [{ email: params.to }],
            ...(params.cc?.length ? { cc: params.cc.map(email => ({ email })) } : {}),
          }],
          from: { email: params.fromAddress, name: params.fromName },
          subject: params.subject,
          content: [{ type: 'text/html', value: params.html }],
          ...(params.attachments?.length ? {
            attachments: params.attachments.map(a => ({
              filename:     a.filename,
              content:      a.content.toString('base64'),
              type:         a.contentType,
              disposition:  'attachment',
            })),
          } : {}),
        }),
      });
      this.logger.log(`SendGrid response status: ${res.status}`);
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`SendGrid error body: ${body}`);
      }
      return res.ok;
    } catch (err) {
      this.logger.error('SendGrid error', err as Error);
      return false;
    }
  }

  private async sendViaSmtp(
    config: Record<string, string>,
    params: SendEmailParams,
  ): Promise<boolean> {
    try {
      const port = Number(config.port ?? 465);
      const transporter = nodemailer.createTransport({
        host: config.host ?? 'smtp.resend.com',
        port,
        secure: port === 465,
        auth: {
          user: config.username ?? 'resend',
          pass: config.password,
        },
      });

      await transporter.sendMail({
        from: `${params.fromName} <${params.fromAddress}>`,
        to: params.to,
        ...(params.cc?.length ? { cc: params.cc.join(', ') } : {}),
        subject: params.subject,
        html: params.html,
        ...(params.attachments?.length ? {
          attachments: params.attachments.map(a => ({
            filename:    a.filename,
            content:     a.content,
            contentType: a.contentType,
          })),
        } : {}),
      });

      this.logger.log(`SMTP email sent to ${params.to}`);
      return true;
    } catch (err) {
      this.logger.error('SMTP error', err as Error);
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
      if (params.cc?.length) form.append('cc', params.cc.join(','));
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
