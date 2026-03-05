import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PLATFORM_DEFAULT_TEMPLATES } from './templates/default-templates';

export interface ResolvedTemplate {
  subject: string;
  body: string;
  source: 'TENANT' | 'PLATFORM';
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
      `SELECT subject, body FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3 AND active = true
       LIMIT 1`,
      [tenantId, eventType, channel],
    );

    if (rows.length && rows[0].body) {
      return {
        subject: rows[0].subject ?? (PLATFORM_DEFAULT_TEMPLATES[eventType]?.[channel] as any)?.subject ?? '',
        body: rows[0].body,
        source: 'TENANT',
      };
    }

    const platformTemplate = PLATFORM_DEFAULT_TEMPLATES[eventType]?.[channel];
    if (platformTemplate) {
      return {
        subject: (platformTemplate as any).subject ?? '',
        body: platformTemplate.body,
        source: 'PLATFORM',
      };
    }

    return { subject: '', body: '', source: 'PLATFORM' };
  }
}
