import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantRoleGuard, TenantRoles } from '../common/guards/tenant-role.guard';
import { renderTemplate } from './template.renderer';
import { PLATFORM_DEFAULT_TEMPLATES } from './templates/default-templates';
import { NotificationService } from './notification.service';

@Controller('notification-templates')
@UseGuards(JwtGuard, TenantRoleGuard)
export class NotificationTemplateController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  /** DEV/TEST: Fire any notification event manually */
  @Post('fire-test')
  @TenantRoles('ADMIN', 'SUPER_ADMIN')
  async fireTest(@Req() req: any, @Body() body: { eventType: string; payload?: Record<string, any> }) {
    const tenantId = req.user.tenant_id;
    const payload = { tenant_id: tenantId, ...(body.payload ?? {}) };
    await this.notificationService.handleEvent(body.eventType, payload);
    return { fired: body.eventType, tenant_id: tenantId, payload };
  }

  @Get()
  async list(@Req() req: any) {
    // Return ALL (including inactive) so UI can show toggle state
    return this.dataSource.query(
      `SELECT * FROM public.tenant_notification_templates
       WHERE tenant_id = $1
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
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3
       LIMIT 1`,
      [req.user.tenant_id, event, channel],
    );
    return rows[0] ?? null;
  }

  @Post()
  @TenantRoles('tenant_admin')
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

  /** PATCH :event/:channel — update active and/or recipients without touching body */
  @Patch(':event/:channel')
  @TenantRoles('tenant_admin')
  async patch(@Req() req: any, @Param('event') event: string, @Param('channel') channel: string, @Body() body: any) {
    const setClauses: string[] = [];
    const params: any[] = [req.user.tenant_id, event, channel];

    if (typeof body.active === 'boolean') {
      params.push(body.active);
      setClauses.push(`active = $${params.length}`);
    }
    if (Array.isArray(body.recipients)) {
      params.push(JSON.stringify(body.recipients));
      setClauses.push(`recipients = $${params.length}::jsonb`);
    }
    if (!setClauses.length) return { success: true };

    setClauses.push(`updated_at = now()`);
    await this.dataSource.query(
      `UPDATE public.tenant_notification_templates
       SET ${setClauses.join(', ')}
       WHERE tenant_id = $1 AND event_type = $2 AND channel = $3`,
      params,
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
  @TenantRoles('tenant_admin')
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
