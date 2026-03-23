import { Body, Controller, Get, Patch, Put, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('tenant-branding')
@UseGuards(JwtGuard)
export class TenantBrandingController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async ensureBookingEntryColumn() {
    await this.db.query(
      `ALTER TABLE public.tenant_branding
         ADD COLUMN IF NOT EXISTS booking_entry_config jsonb`,
    ).catch(() => {});
  }

  private async ensureCustomCssColumns() {
    await this.db.query(
      `ALTER TABLE public.tenant_branding
         ADD COLUMN IF NOT EXISTS custom_css text,
         ADD COLUMN IF NOT EXISTS custom_css_url text`,
    ).catch(() => {});
  }

  @Get()
  async get(@Req() req: any) {
    await this.ensureBookingEntryColumn();
    await this.ensureCustomCssColumns();
    const rows = await this.db.query(
      `SELECT * FROM public.tenant_branding WHERE tenant_id=$1`,
      [req.user.tenant_id],
    );
    return rows[0] ?? null;
  }

  @Put()
  async upsert(@Req() req: any, @Body() body: any) {
    await this.ensureBookingEntryColumn();
    await this.ensureCustomCssColumns();
    const [row] = await this.db.query(
      `INSERT INTO public.tenant_branding
         (tenant_id, logo_url, primary_color, primary_foreground, font_family,
          company_name, contact_email, contact_phone, custom_domain,
          cancel_window_hours, website_url, custom_css, custom_css_url, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
       ON CONFLICT (tenant_id) DO UPDATE
         SET logo_url              = EXCLUDED.logo_url,
             primary_color         = EXCLUDED.primary_color,
             primary_foreground    = EXCLUDED.primary_foreground,
             font_family           = EXCLUDED.font_family,
             company_name          = EXCLUDED.company_name,
             contact_email         = EXCLUDED.contact_email,
             contact_phone         = EXCLUDED.contact_phone,
             custom_domain         = EXCLUDED.custom_domain,
             cancel_window_hours   = EXCLUDED.cancel_window_hours,
             website_url           = EXCLUDED.website_url,
             custom_css            = EXCLUDED.custom_css,
             custom_css_url        = EXCLUDED.custom_css_url,
             updated_at            = now()
       RETURNING *`,
      [
        req.user.tenant_id,
        body.logoUrl            ?? null,
        body.primaryColor       ?? null,
        body.primaryForeground  ?? null,
        body.fontFamily         ?? null,
        body.companyName        ?? null,
        body.contactEmail       ?? null,
        body.contactPhone       ?? null,
        body.customDomain       ?? null,
        body.cancelWindowHours  ?? null,
        body.websiteUrl         ?? null,
        body.customCss          ?? null,
        body.customCssUrl       ?? null,
      ],
    );

    // Sync to tenant_settings.settings->branding for public tenant-info consumers
    try {
      const branding = {
        logo_url: row?.logo_url ?? null,
        primary_color: row?.primary_color ?? null,
        primary_foreground: row?.primary_foreground ?? null,
        font_family: row?.font_family ?? null,
        company_name: row?.company_name ?? null,
        contact_email: row?.contact_email ?? null,
        contact_phone: row?.contact_phone ?? null,
        custom_domain: row?.custom_domain ?? null,
        cancel_window_hours: row?.cancel_window_hours ?? null,
        website_url: row?.website_url ?? null,
        custom_css: row?.custom_css ?? null,
        custom_css_url: row?.custom_css_url ?? null,
      };
      await this.db.query(
        `INSERT INTO public.tenant_settings (tenant_id, settings, updated_at)
         VALUES ($1, jsonb_build_object('branding', $2::jsonb), now())
         ON CONFLICT (tenant_id) DO UPDATE
           SET settings = COALESCE(public.tenant_settings.settings, '{}'::jsonb) || jsonb_build_object('branding', $2::jsonb),
               updated_at = now()`,
        [req.user.tenant_id, JSON.stringify(branding)],
      );
    } catch {}

    return row;
  }

  @Get('me/booking-entry-config')
  async getBookingEntry(@Req() req: any) {
    await this.ensureBookingEntryColumn();
    const rows = await this.db.query(
      `SELECT booking_entry_config FROM public.tenant_branding WHERE tenant_id=$1`,
      [req.user.tenant_id],
    );
    return rows[0]?.booking_entry_config ?? null;
  }

  @Patch('me/booking-entry-config')
  async updateBookingEntry(@Req() req: any, @Body() body: any) {
    await this.ensureBookingEntryColumn();
    const [row] = await this.db.query(
      `INSERT INTO public.tenant_branding (tenant_id, booking_entry_config, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (tenant_id) DO UPDATE
         SET booking_entry_config = $2,
             updated_at = now()
       RETURNING booking_entry_config`,
      [req.user.tenant_id, body ?? {}],
    );
    return row?.booking_entry_config ?? null;
  }
}
