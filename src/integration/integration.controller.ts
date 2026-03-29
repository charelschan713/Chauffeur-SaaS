import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';
import { EncryptionService } from './encryption.service';
import { IntegrationService } from './integration.service';
import { IntegrationResolver } from './integration.resolver';

@Controller('integrations')
@UseGuards(JwtGuard)
export class IntegrationController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly encryptionService: EncryptionService,
    private readonly integrationService: IntegrationService,
    private readonly integrationResolver: IntegrationResolver,
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
    const { maskedPreview, ...incoming } = body;

    // Merge with existing config to avoid wiping secrets when UI sends partial fields.
    let existing: Record<string, any> = {};
    const existingRows = await this.dataSource.query(
      `SELECT config_encrypted
       FROM public.tenant_integrations
       WHERE tenant_id = $1 AND integration_type = $2
       LIMIT 1`,
      [req.user.tenant_id, type],
    );
    if (existingRows.length && existingRows[0].config_encrypted) {
      try {
        const raw =
          typeof existingRows[0].config_encrypted === 'string'
            ? existingRows[0].config_encrypted
            : JSON.stringify(existingRows[0].config_encrypted);
        existing = JSON.parse(this.encryptionService.decrypt(raw));
      } catch {
        existing = {};
      }
    }

    const merged = { ...existing, ...incoming } as Record<string, any>;

    // Normalize aliases and trim whitespace.
    for (const [k, v] of Object.entries(merged)) {
      if (typeof v === 'string') merged[k] = v.trim();
    }
    if (type === 'resend') {
      if (merged.apiKey && !merged.api_key) merged.api_key = merged.apiKey;
    }
    if (type === 'twilio') {
      if (merged.authToken && !merged.auth_token) merged.auth_token = merged.authToken;
      if (merged.sender_id && !merged.sender) merged.sender = merged.sender_id;
      if (merged.apiKey && !merged.api_key) merged.api_key = merged.apiKey;
    }

    const configEncrypted = this.encryptionService.encrypt(JSON.stringify(merged));
    const effectiveKey = merged.api_key ?? merged.password ?? merged.auth_token ?? null;
    const maskedPreviewValue =
      maskedPreview ??
      (effectiveKey ? `****${String(effectiveKey).slice(-4)}` : null);

    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_integrations (tenant_id, integration_type, config_encrypted, masked_preview, active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (tenant_id, integration_type)
       DO UPDATE SET config_encrypted = EXCLUDED.config_encrypted,
                     masked_preview = EXCLUDED.masked_preview,
                     active = true,
                     updated_at = now()
       RETURNING id`,
      [req.user.tenant_id, type, configEncrypted, maskedPreviewValue],
    );

    // Auto-sync currency from Stripe after save
    if (type === 'stripe' && merged.secret_key) {
      await this.integrationService.syncStripeCurrency(
        req.user.tenant_id,
        merged.secret_key,
      );
    }

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

  @Patch(':type/active')
  async setActive(@Param('type') type: string, @Body() body: any, @Req() req: any) {
    const active = body?.active === true;
    const rows = await this.dataSource.query(
      `UPDATE public.tenant_integrations
       SET active = $3, updated_at = now()
       WHERE tenant_id = $1 AND integration_type = $2
       RETURNING id`,
      [req.user.tenant_id, type, active],
    );
    if (!rows.length) throw new NotFoundException('Integration not found');
    return { success: true, active };
  }

  @Post('test/:type')
  async testIntegration(@Param('type') type: string, @Req() req: any) {
    const result = await this.integrationService.test(req.user.tenant_id, type);

    // Also sync currency on successful Stripe test
    if (type === 'stripe' && result.success) {
      const integration = await this.integrationResolver.resolve(req.user.tenant_id, 'stripe');
      if (integration?.config?.secret_key) {
        await this.integrationService.syncStripeCurrency(
          req.user.tenant_id,
          integration.config.secret_key,
        );
      }
    }

    return result;
  }

  @Get('debug/key-check')
  async debugKeyCheck() {
    const key = process.env.ENCRYPTION_KEY ?? '';
    return {
      set: key.length > 0,
      length: key.length,
      valid: key.length === 64 && /^[0-9a-fA-F]+$/.test(key),
      expected: '64 hex characters',
    };
  }

  @Post('stripe/sync-currency')
  async syncStripeCurrency(@Req() req: any) {
    const integration = await this.integrationResolver.resolve(req.user.tenant_id, 'stripe');
    if (!integration) throw new NotFoundException('Stripe not configured');
    const currency = await this.integrationService.syncStripeCurrency(
      req.user.tenant_id,
      integration.config.secret_key,
    );
    return { currency };
  }

  @Get('debug/:type')
  async debugIntegration(@Param('type') type: string, @Req() req: any) {
    const rows = await this.dataSource.query(
      `SELECT config_encrypted FROM public.tenant_integrations
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
        account_sid_preview: config.account_sid?.substring(0, 8) ?? 'missing',
        api_key_length: config.api_key?.length ?? 0,
        sender: config.sender ?? 'missing',
      };
    } catch (err: any) {
      return { found: true, error: err?.message ?? 'decrypt failed' };
    }
  }

}
