import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';
import { EncryptionService } from './encryption.service';
import { IntegrationService } from './integration.service';

@Controller('integrations')
@UseGuards(JwtGuard)
export class IntegrationController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly encryptionService: EncryptionService,
    private readonly integrationService: IntegrationService,
  ) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT integration_type as type, active, masked_preview
       FROM public.tenant_integrations
       WHERE tenant_id = $1
       ORDER BY integration_type ASC`,
      [req.user.tenant_id],
    );
  }

  @Post(':type')
  async upsert(@Param('type') type: string, @Body() body: any, @Req() req: any) {
    const configEncrypted = this.encryptionService.encrypt(JSON.stringify(body.config ?? {}));
    const maskedPreview = body.maskedPreview ?? null;
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_integrations (tenant_id, integration_type, config_encrypted, masked_preview, active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (tenant_id, integration_type)
       DO UPDATE SET config_encrypted = EXCLUDED.config_encrypted,
                     masked_preview = EXCLUDED.masked_preview,
                     active = true,
                     updated_at = now()
       RETURNING id`,
      [req.user.tenant_id, type, configEncrypted, maskedPreview],
    );
    return { success: true, id: rows[0]?.id };
  }

  @Delete(':type')
  async deactivate(@Param('type') type: string, @Req() req: any) {
    await this.dataSource.query(
      `UPDATE public.tenant_integrations
       SET active = false, updated_at = now()
       WHERE tenant_id = $1 AND integration_type = $2`,
      [req.user.tenant_id, type],
    );
    return { success: true };
  }

  @Post('test/:type')
  async testIntegration(@Param('type') type: string, @Req() req: any) {
    return this.integrationService.test(req.user.tenant_id, type);
  }

  @Get('test-network')
  async testNetwork() {
    try {
      const res = await fetch('https://api.resend.com');
      return { status: res.status, ok: res.ok };
    } catch (err: any) {
      return { error: err?.message ?? 'Network test failed' };
    }
  }

  @Get('debug/:type')
  async debugIntegration(@Param('type') type: string, @Req() req: any) {
    const rows = await this.dataSource.query(
      `SELECT config_encrypted, masked_preview
       FROM public.tenant_integrations
       WHERE tenant_id = $1 AND integration_type = $2`,
      [req.user.tenant_id, type],
    );

    if (!rows.length) return { found: false };

    const raw = rows[0].config_encrypted;
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);

    try {
      const decrypted = this.encryptionService.decrypt(rawStr);
      const config = JSON.parse(decrypted);
      return {
        found: true,
        keys: Object.keys(config),
        api_key_preview: config.api_key?.substring(0, 8) ?? 'missing',
        raw_type: typeof raw,
        raw_preview: rawStr.substring(0, 50),
      };
    } catch (err: any) {
      return {
        found: true,
        decrypt_error: err?.message ?? 'decrypt failed',
        raw_type: typeof raw,
        raw_preview: rawStr.substring(0, 100),
      };
    }
  }
}
