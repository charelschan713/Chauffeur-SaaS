import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtGuard } from '../common/guards/jwt.guard';
import { renderTemplate } from './template.renderer';
import { PLATFORM_DEFAULT_TEMPLATES } from './templates/default-templates';

@Controller('notification-templates')
@UseGuards(JwtGuard)
export class NotificationTemplateController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT * FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND active = true
       ORDER BY event_type, channel`,
      [req.user.tenant_id],
    );
  }

  @Get('defaults')
  async getDefaults() {
    return PLATFORM_DEFAULT_TEMPLATES;
  }

  @Get(':event/:channel')
  async get(@Req() req: any, @Param('event') event: string, @Param('channel') channel: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM public.tenant_notification_templates
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3 AND active = true
       LIMIT 1`,
      [req.user.tenant_id, event, channel],
    );
    return rows[0] ?? null;
  }

  @Post()
  async upsert(@Req() req: any, @Body() body: any) {
    await this.dataSource.query(
      `INSERT INTO public.tenant_notification_templates
         (tenant_id, event_type, channel, subject, body, active)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (tenant_id, event_type, channel)
       DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, active = true, updated_at = now()`,
      [req.user.tenant_id, body.event_type, body.channel, body.subject, body.body],
    );
    return { success: true };
  }

  @Post('preview')
  async preview(@Req() req: any, @Body() body: any) {
    const { channel, subject, body: templateBody } = body;
    if (channel === 'sms') {
      return {
        text_rendered: renderTemplate(templateBody, {}),
      };
    }

    return {
      subject_rendered: renderTemplate(subject ?? '', {}),
      html_rendered: renderTemplate(templateBody ?? '', {}),
    };
  }

  @Delete(':event/:channel')
  async reset(@Req() req: any, @Param('event') event: string, @Param('channel') channel: string) {
    await this.dataSource.query(
      `UPDATE public.tenant_notification_templates
       SET active = false, updated_at = now()
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3`,
      [req.user.tenant_id, event, channel],
    );
    return { success: true };
  }

  // ─── Notification Logs ──────────────────────────────────────────────────────

  @Get('notification-logs')
  async listLogs(
    @Req() req: any,
    @Query('event_type') eventType?: string,
    @Query('booking_id') bookingId?: string,
  ) {
    const tenantId = req.user.tenant_id;
    let sql = `SELECT id, event_type, channel, recipient_type, recipient_email, recipient_phone,
                      subject, status, sent_at, booking_id
               FROM public.notification_log
               WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    if (eventType) { params.push(eventType); sql += ` AND event_type = $${params.length}`; }
    if (bookingId) { params.push(bookingId); sql += ` AND booking_id = $${params.length}`; }
    sql += ` ORDER BY sent_at DESC LIMIT 100`;
    return this.dataSource.query(sql, params);
  }

  @Get('notification-logs/:id')
  async getLog(@Req() req: any, @Param('id') id: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM public.notification_log WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    if (!rows.length) throw new NotFoundException('Log not found');
    return rows[0];
  }
}
