import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';
import { TenantInvoiceService } from './tenant-invoice.service';

@Controller('tenants')
@UseGuards(JwtGuard)
export class TenantController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invoiceProfileService: TenantInvoiceService,
  ) {}

  @Get('settings')
  async getSettings(@Req() req: any) {
    const rows = await this.dataSource.query(
      `SELECT t.auto_assign_enabled,
              t.default_driver_pay_type,
              t.default_driver_pay_value,
              ts.settings->'widget_settings' AS widget_settings
         FROM public.tenants t
         LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
        WHERE t.id = $1`,
      [req.user.tenant_id],
    );
    return rows[0] ?? null;
  }

  @Patch('settings')
  async updateSettings(@Req() req: any, @Body() body: any) {
    const tenantId = req.user.tenant_id;

    const rows = await this.dataSource.query(
      `UPDATE public.tenants
          SET auto_assign_enabled = COALESCE($1, auto_assign_enabled),
              default_driver_pay_type = COALESCE($2, default_driver_pay_type),
              default_driver_pay_value = COALESCE($3, default_driver_pay_value),
              updated_at = now()
        WHERE id = $4
        RETURNING auto_assign_enabled, default_driver_pay_type, default_driver_pay_value`,
      [
        body.auto_assign_enabled ?? null,
        body.default_driver_pay_type ?? null,
        body.default_driver_pay_value ?? null,
        tenantId,
      ],
    );

    // Widget settings stored in tenant_settings.settings.widget_settings
    if (body.widget_settings !== undefined) {
      await this.dataSource.query(
        `INSERT INTO public.tenant_settings (tenant_id, settings)
         VALUES ($1, jsonb_build_object('widget_settings', $2::jsonb))
         ON CONFLICT (tenant_id) DO UPDATE
           SET settings = jsonb_set(
             COALESCE(public.tenant_settings.settings, '{}'::jsonb),
             '{widget_settings}',
             $2::jsonb,
             true
           ),
               updated_at = now()`,
        [tenantId, JSON.stringify(body.widget_settings ?? {})],
      );
    }

    return {
      ...(rows[0] ?? {}),
      widget_settings: body.widget_settings ?? null,
    };
  }

  // ── Business / Company Profile ────────────────────────────────────────────

  @Get('business')
  async getBusiness(@Req() req: any) {
    const rows = await this.dataSource.query(
      `SELECT id, name, slug, custom_domain, booking_ref_prefix,
              business_name, trading_name, abn, is_gst_registered,
              address_line1, address_line2, city, state, postcode, country,
              phone, email, website, logo_url,
              accounts_contact_name, support_email, company_profile_short,
              invoice_notes, invoice_footer,
              bank_name, bank_account_name, bank_bsb, bank_account_number
         FROM public.tenants WHERE id = $1`,
      [req.user.tenant_id],
    );
    return rows[0] ?? {};
  }

  @Patch('business')
  async updateBusiness(@Req() req: any, @Body() body: any) {
    await this.dataSource.query(
      `UPDATE public.tenants
          SET business_name        = COALESCE($1,  business_name),
              trading_name         = COALESCE($2,  trading_name),
              abn                  = COALESCE($3,  abn),
              is_gst_registered    = COALESCE($4,  is_gst_registered),
              address_line1        = COALESCE($5,  address_line1),
              address_line2        = COALESCE($6,  address_line2),
              city                 = COALESCE($7,  city),
              state                = COALESCE($8,  state),
              postcode             = COALESCE($9,  postcode),
              country              = COALESCE($10, country),
              phone                = COALESCE($11, phone),
              email                = COALESCE($12, email),
              website              = COALESCE($13, website),
              logo_url             = COALESCE($14, logo_url),
              accounts_contact_name = COALESCE($15, accounts_contact_name),
              support_email        = COALESCE($16, support_email),
              company_profile_short = COALESCE($17, company_profile_short),
              invoice_notes        = COALESCE($18, invoice_notes),
              invoice_footer       = COALESCE($19, invoice_footer),
              bank_name            = COALESCE($20, bank_name),
              bank_account_name    = COALESCE($21, bank_account_name),
              bank_bsb             = COALESCE($22, bank_bsb),
              bank_account_number  = COALESCE($23, bank_account_number),
              custom_domain        = COALESCE($24, custom_domain),
              booking_ref_prefix   = COALESCE($25, booking_ref_prefix),
              updated_at           = now()
        WHERE id = $26`,
      [
        body.business_name ?? null,
        body.trading_name ?? null,
        body.abn ?? null,
        body.is_gst_registered ?? null,
        body.address_line1 ?? null, body.address_line2 ?? null,
        body.city ?? null, body.state ?? null, body.postcode ?? null, body.country ?? null,
        body.phone ?? null, body.email ?? null, body.website ?? null, body.logo_url ?? null,
        body.accounts_contact_name ?? null,
        body.support_email ?? null,
        body.company_profile_short ?? null,
        body.invoice_notes ?? null, body.invoice_footer ?? null,
        body.bank_name ?? null, body.bank_account_name ?? null,
        body.bank_bsb ?? null, body.bank_account_number ?? null,
        body.custom_domain ?? null,
        body.booking_ref_prefix ? body.booking_ref_prefix.trim().toUpperCase() : null,
        req.user.tenant_id,
      ],
    );
    // Sync logo_url → tenant_branding (used by public /tenant-info endpoint)
    if (body.logo_url !== undefined) {
      await this.dataSource.query(
        `INSERT INTO public.tenant_branding (tenant_id, logo_url)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO UPDATE SET logo_url = EXCLUDED.logo_url`,
        [req.user.tenant_id, body.logo_url],
      );
    }
    return { success: true };
  }

  // ── Invoice Profile ───────────────────────────────────────────────────────

  @Get('invoice-profile')
  getInvoiceProfile(@Req() req: any) {
    return this.invoiceProfileService.getProfile(req.user.tenant_id);
  }

  @Patch('invoice-profile')
  upsertInvoiceProfile(@Req() req: any, @Body() body: any) {
    return this.invoiceProfileService.upsertProfile(req.user.tenant_id, body);
  }

  // ── Invoice Readiness ─────────────────────────────────────────────────────
  // Returns structured summary: company_profile / invoice_profile / payment_instruction
  // invoice_ready = true only when all 3 pass.

  @Get('invoice-readiness')
  getInvoiceReadiness(@Req() req: any) {
    return this.invoiceProfileService.checkReadiness(req.user.tenant_id);
  }
}
