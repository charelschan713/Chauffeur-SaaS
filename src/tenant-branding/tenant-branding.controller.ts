import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('tenant-branding')
@UseGuards(JwtGuard)
export class TenantBrandingController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  async get(@Req() req: any) {
    const rows = await this.db.query(
      `SELECT * FROM public.tenant_branding WHERE tenant_id=$1`,
      [req.user.tenant_id],
    );
    return rows[0] ?? null;
  }

  @Put()
  async upsert(@Req() req: any, @Body() body: any) {
    const [row] = await this.db.query(
      `INSERT INTO public.tenant_branding
         (tenant_id, logo_url, primary_color, company_name, contact_email, contact_phone, custom_domain, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (tenant_id) DO UPDATE
         SET logo_url=EXCLUDED.logo_url,
             primary_color=EXCLUDED.primary_color,
             company_name=EXCLUDED.company_name,
             contact_email=EXCLUDED.contact_email,
             contact_phone=EXCLUDED.contact_phone,
             custom_domain=EXCLUDED.custom_domain,
             updated_at=now()
       RETURNING *`,
      [
        req.user.tenant_id,
        body.logoUrl ?? null,
        body.primaryColor ?? '#2563eb',
        body.companyName ?? null,
        body.contactEmail ?? null,
        body.contactPhone ?? null,
        body.customDomain ?? null,
      ],
    );
    return row;
  }
}
