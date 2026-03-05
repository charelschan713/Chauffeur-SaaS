import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';

@Controller('tenants')
@UseGuards(JwtGuard)
export class TenantController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('settings')
  async getSettings(@Req() req: any) {
    const rows = await this.dataSource.query(
      `SELECT auto_assign_enabled, default_driver_pay_type, default_driver_pay_value
         FROM public.tenants
        WHERE id = $1`,
      [req.user.tenant_id],
    );
    return rows[0] ?? null;
  }

  @Patch('settings')
  async updateSettings(@Req() req: any, @Body() body: any) {
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
        req.user.tenant_id,
      ],
    );
    return rows[0];
  }

  // ── Business / Invoice Info ───────────────────────────────────────────────

  @Get('business')
  async getBusiness(@Req() req: any) {
    const rows = await this.dataSource.query(
      `SELECT name, business_name, abn,
              address_line1, address_line2, city, state, postcode, country,
              phone, email, website, logo_url,
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
              abn                  = COALESCE($2,  abn),
              address_line1        = COALESCE($3,  address_line1),
              address_line2        = COALESCE($4,  address_line2),
              city                 = COALESCE($5,  city),
              state                = COALESCE($6,  state),
              postcode             = COALESCE($7,  postcode),
              country              = COALESCE($8,  country),
              phone                = COALESCE($9,  phone),
              email                = COALESCE($10, email),
              website              = COALESCE($11, website),
              logo_url             = COALESCE($12, logo_url),
              invoice_notes        = COALESCE($13, invoice_notes),
              invoice_footer       = COALESCE($14, invoice_footer),
              bank_name            = COALESCE($15, bank_name),
              bank_account_name    = COALESCE($16, bank_account_name),
              bank_bsb             = COALESCE($17, bank_bsb),
              bank_account_number  = COALESCE($18, bank_account_number),
              updated_at           = now()
        WHERE id = $19`,
      [
        body.business_name ?? null, body.abn ?? null,
        body.address_line1 ?? null, body.address_line2 ?? null,
        body.city ?? null, body.state ?? null, body.postcode ?? null, body.country ?? null,
        body.phone ?? null, body.email ?? null, body.website ?? null, body.logo_url ?? null,
        body.invoice_notes ?? null, body.invoice_footer ?? null,
        body.bank_name ?? null, body.bank_account_name ?? null,
        body.bank_bsb ?? null, body.bank_account_number ?? null,
        req.user.tenant_id,
      ],
    );
    return { success: true };
  }
}
