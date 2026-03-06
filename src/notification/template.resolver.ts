import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PLATFORM_DEFAULT_TEMPLATES } from './templates/default-templates';

export interface ResolvedTemplate {
  subject: string;
  body: string;
  source: 'TENANT' | 'PLATFORM';
  recipients: string[]; // e.g. ["customer","driver","admin"]
  active: boolean;
}

@Injectable()
export class TemplateResolver {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(
    tenantId: string,
    eventType: string,
    channel: 'email' | 'sms',
  ): Promise<ResolvedTemplate> {
    const rows = await this.dataSource.query(
      `SELECT subject, body, active, recipients FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3
       LIMIT 1`,
      [tenantId, eventType, channel],
    );

    if (rows.length && rows[0].body) {
      const row = rows[0];
      if (!row.active) {
        return { subject: '', body: '', source: 'TENANT', recipients: [], active: false };
      }
      const recipients: string[] = Array.isArray(row.recipients)
        ? row.recipients
        : (typeof row.recipients === 'string' ? JSON.parse(row.recipients) : ['customer']);
      return {
        subject: row.subject ?? (PLATFORM_DEFAULT_TEMPLATES[eventType]?.[channel] as any)?.subject ?? '',
        body: row.body,
        source: 'TENANT',
        recipients,
        active: true,
      };
    }

    const platformTemplate = PLATFORM_DEFAULT_TEMPLATES[eventType]?.[channel];
    if (platformTemplate) {
      return {
        subject: (platformTemplate as any).subject ?? '',
        body: platformTemplate.body,
        source: 'PLATFORM',
        recipients: ['customer'],
        active: true,
      };
    }

    return { subject: '', body: '', source: 'PLATFORM', recipients: [], active: false };
  }
}
