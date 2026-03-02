import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EncryptionService } from './encryption.service';

export interface ResolvedIntegration {
  provider: string;
  config: Record<string, string>;
  source: 'TENANT' | 'PLATFORM';
}

@Injectable()
export class IntegrationResolver {
  private readonly logger = new Logger(IntegrationResolver.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  async resolve(
    tenantId: string,
    integrationType: string,
  ): Promise<ResolvedIntegration | null> {
    const rows = await this.dataSource.query(
      `SELECT config_encrypted, integration_type
       FROM public.tenant_integrations
       WHERE tenant_id = $1
         AND integration_type = $2
         AND active = true
       LIMIT 1`,
      [tenantId, integrationType],
    );

    if (rows.length && rows[0].config_encrypted) {
      try {
        const raw =
          typeof rows[0].config_encrypted === 'string'
            ? rows[0].config_encrypted
            : JSON.stringify(rows[0].config_encrypted);
        const config = JSON.parse(this.encryption.decrypt(raw));
        this.logger.log(`Resolved config keys: ${Object.keys(config).join(', ')}`);
        this.logger.log(`api_key starts with: ${config.api_key?.substring(0, 8)}`);
        return {
          provider: rows[0].integration_type,
          config,
          source: 'TENANT',
        };
      } catch {
        // fall through to platform default
      }
    }

    return this.platformDefault(integrationType);
  }

  private platformDefault(
    integrationType: string,
  ): ResolvedIntegration | null {
    switch (integrationType) {
      case 'sendgrid':
        if (!process.env.SENDGRID_API_KEY) return null;
        return {
          provider: 'sendgrid',
          config: {
            api_key: process.env.SENDGRID_API_KEY,
            from_address:
              process.env.SENDGRID_FROM_EMAIL ?? 'noreply@platform.com',
            from_name:
              process.env.SENDGRID_FROM_NAME ?? 'Chauffeur Platform',
          },
          source: 'PLATFORM',
        };
      case 'twilio':
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)
          return null;
        return {
          provider: 'twilio',
          config: {
            account_sid: process.env.TWILIO_ACCOUNT_SID,
            api_key: process.env.TWILIO_AUTH_TOKEN,
            sender: process.env.TWILIO_FROM_NUMBER ?? '',
          },
          source: 'PLATFORM',
        };
      case 'resend':
        if (!process.env.RESEND_API_KEY) return null;
        return {
          provider: 'resend',
          config: {
            api_key: process.env.RESEND_API_KEY,
            from_address:
              process.env.RESEND_FROM_EMAIL ?? 'noreply@yourdomain.com',
            from_name:
              process.env.RESEND_FROM_NAME ?? 'Chauffeur Platform',
          },
          source: 'PLATFORM',
        };
      case 'smtp':
        if (!process.env.SMTP_PASSWORD) return null;
        return {
          provider: 'smtp',
          config: {
            host: process.env.SMTP_HOST ?? 'smtp.resend.com',
            port: process.env.SMTP_PORT ?? '465',
            username: process.env.SMTP_USERNAME ?? 'resend',
            password: process.env.SMTP_PASSWORD,
            from_address:
              process.env.SMTP_FROM_EMAIL ?? 'noreply@platform.com',
            from_name: process.env.SMTP_FROM_NAME ?? 'Chauffeur Platform',
          },
          source: 'PLATFORM',
        };
      default:
        return null;
    }
  }
}
