import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';
import { renderTemplate, TemplateVariables } from './template.renderer';

const DEMO_VARS: TemplateVariables = {
  booking_reference: 'BK-DEMO123',
  customer_first_name: 'John',
  customer_last_name: 'Smith',
  pickup_address: 'Sydney Airport T1',
  dropoff_address: 'CBD Hotel Sydney',
  pickup_time: '26 Feb 2026 07:00 AM (Sydney)',
  driver_name: 'Michael Johnson',
  vehicle_make: 'Mercedes',
  vehicle_model: 'S-Class',
  total_amount: '120.00',
  currency: 'AUD',
};

@Controller('notification-templates')
@UseGuards(JwtGuard)
export class NotificationTemplateController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT id, event_type, channel, subject, body, active
       FROM public.tenant_notification_templates
       WHERE tenant_id = $1
       ORDER BY event_type, channel`,
      [req.user.tenant_id],
    );
  }

  @Get(':eventType/:channel')
  async get(
    @Param('eventType') eventType: string,
    @Param('channel') channel: string,
    @Req() req: any,
  ) {
    const rows = await this.dataSource.query(
      `SELECT id, event_type, channel, subject, body, active
       FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3
       LIMIT 1`,
      [req.user.tenant_id, eventType, channel],
    );
    return rows[0] ?? null;
  }

  @Post()
  async upsert(@Body() body: any, @Req() req: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_notification_templates
         (tenant_id, event_type, channel, subject, body, active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (tenant_id, event_type, channel)
       DO UPDATE SET subject = EXCLUDED.subject,
                     body = EXCLUDED.body,
                     active = true,
                     updated_at = now()
       RETURNING id`,
      [req.user.tenant_id, body.event_type, body.channel, body.subject ?? null, body.body],
    );
    return { success: true, id: rows[0].id };
  }

  @Delete(':eventType/:channel')
  async reset(
    @Param('eventType') eventType: string,
    @Param('channel') channel: string,
    @Req() req: any,
  ) {
    await this.dataSource.query(
      `DELETE FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3`,
      [req.user.tenant_id, eventType, channel],
    );
    return { success: true };
  }

  @Post('preview')
  async preview(@Body() body: any) {
    const rendered = renderTemplate(body.body ?? '', DEMO_VARS);
    const subject = renderTemplate(body.subject ?? '', DEMO_VARS);
    if (body.channel === 'sms') {
      return { text_rendered: rendered };
    }
    return { subject_rendered: subject, html_rendered: rendered };
  }
}
