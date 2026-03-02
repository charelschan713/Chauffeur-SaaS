import { Injectable } from '@nestjs/common';
import { IntegrationResolver } from './integration.resolver';

@Injectable()
export class IntegrationService {
  constructor(private readonly resolver: IntegrationResolver) {}

  async test(
    tenantId: string,
    type: string,
  ): Promise<{ success: boolean; message: string }> {
    const integration = await this.resolver.resolve(tenantId, type);
    if (!integration) {
      return { success: false, message: 'Integration not configured' };
    }

    if (type === 'smtp') {
      return this.testSmtp(integration.config);
    }

    if (type === 'twilio') {
      return this.testTwilio(integration.config);
    }

    return { success: true, message: 'Configuration saved' };
  }

  private async testSmtp(config: Record<string, string>) {
    try {
      const nodemailer = await import('nodemailer');
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
      await transporter.verify();
      return { success: true, message: 'SMTP connection verified' };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message ?? 'SMTP connection failed',
      };
    }
  }

  private async testTwilio(config: Record<string, string>) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${config.account_sid}:${config.api_key}`,
            ).toString('base64')}`,
          },
        },
      );
      if (res.ok) return { success: true, message: 'Twilio connection verified' };
      return { success: false, message: 'Twilio credentials invalid' };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message ?? 'Twilio connection failed',
      };
    }
  }
}
