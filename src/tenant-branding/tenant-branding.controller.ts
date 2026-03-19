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

  @Get()
  async get(@Req() req: any) {
    await this.ensureBookingEntryColumn();
    const rows = await this.db.query(
      `SELECT * FROM public.tenant_branding WHERE tenant_id=$1`,
      [req.user.tenant_id],
    );
    return rows[0] ?? null;
  }

  @Put()
  async upsert(@Req() req: any, @Body() body: any) {
    await this.ensureBookingEntryColumn();
    const [row] = await this.db.query(
      `INSERT INTO public.tenant_branding
         (tenant_id, logo_url, primary_color, primary_foreground, font_family,
          company_name, contact_email, contact_phone, custom_domain,
          cancel_window_hours, website_url, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
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
      ],
    );
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
