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
}
