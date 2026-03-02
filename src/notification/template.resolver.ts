import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
    platformDefault: ResolvedTemplate,
  ): Promise<ResolvedTemplate> {
    const rows = await this.dataSource.query(
      `SELECT subject, body FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3 AND active = true
       LIMIT 1`,
      [tenantId, eventType, channel],
    );

    if (rows.length && rows[0].body) {
      return {
        subject: rows[0].subject ?? platformDefault.subject,
        body: rows[0].body,
        source: 'TENANT',
      };
    }

    return { ...platformDefault, source: 'PLATFORM' };
  }
}
