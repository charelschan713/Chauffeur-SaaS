import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';

@Controller('service-types')
@UseGuards(JwtGuard)
export class ServiceTypeController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT id, code, display_name, calculation_type,
              one_way_type, one_way_value, one_way_surcharge_minor,
              return_type, return_value, return_surcharge_minor,
              minimum_hours, km_per_hour_included, hourly_tiers,
              booking_flow, active, toll_enabled
       FROM public.tenant_service_types
       WHERE tenant_id = $1
       ORDER BY display_name ASC`,
      [req.user.tenant_id],
    );
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const code =
      body.code ?? body.display_name.toUpperCase().replace(/\s+/g, '_');
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_service_types
         (tenant_id, code, display_name, calculation_type,
          one_way_type, one_way_value, one_way_surcharge_minor,
          return_type, return_value, return_surcharge_minor,
          minimum_hours, km_per_hour_included, hourly_tiers,
          booking_flow, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
       RETURNING id`,
      [
        req.user.tenant_id,
        code,
        body.display_name,
        body.calculation_type ?? 'POINT_TO_POINT',
        body.one_way_type ?? 'PERCENTAGE',
        body.one_way_value ?? 100,
        body.one_way_surcharge_minor ?? 0,
        body.return_type ?? 'PERCENTAGE',
        body.return_value ?? 100,
        body.return_surcharge_minor ?? 0,
        body.minimum_hours ?? 2,
        body.km_per_hour_included ?? 0,
        JSON.stringify(body.hourly_tiers ?? []),
        JSON.stringify(body.booking_flow ?? {}),
      ],
    );
    return { id: rows[0].id };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.dataSource.query(
      `UPDATE public.tenant_service_types SET
         display_name = COALESCE($3, display_name),
         calculation_type = COALESCE($4, calculation_type),
         one_way_type = COALESCE($5, one_way_type),
         one_way_value = COALESCE($6, one_way_value),
         one_way_surcharge_minor = COALESCE($7, one_way_surcharge_minor),
         return_type = COALESCE($8, return_type),
         return_value = COALESCE($9, return_value),
         return_surcharge_minor = COALESCE($10, return_surcharge_minor),
         minimum_hours = COALESCE($11, minimum_hours),
         km_per_hour_included = COALESCE($12, km_per_hour_included),
         hourly_tiers = COALESCE($13, hourly_tiers),
         active = COALESCE($14, active),
         toll_enabled = COALESCE($15, toll_enabled),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [
        id,
        req.user.tenant_id,
        body.display_name,
        body.calculation_type,
        body.one_way_type,
        body.one_way_value,
        body.one_way_surcharge_minor,
        body.return_type,
        body.return_value,
        body.return_surcharge_minor,
        body.minimum_hours,
        body.km_per_hour_included,
        body.hourly_tiers ? JSON.stringify(body.hourly_tiers) : null,
        body.active,
        body.toll_enabled !== undefined ? body.toll_enabled : null,
      ],
    );
    return { success: true };
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string, @Req() req: any) {
    await this.dataSource.query(
      `UPDATE public.tenant_service_types
       SET active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }
}
