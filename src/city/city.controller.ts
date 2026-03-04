import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';

@Controller('cities')
@UseGuards(JwtGuard)
export class CityController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT id, name, timezone, active
       FROM public.tenant_service_cities
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [req.user.tenant_id],
    );
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_service_cities
         (tenant_id, name, timezone, active)
       VALUES ($1, $2, $3, true)
       RETURNING id, name, timezone, active`,
      [req.user.tenant_id, body.name, body.timezone],
    );
    return rows[0];
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    // Guard: no active bookings referencing this city
    const check = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.bookings
       WHERE city_id = $1 AND tenant_id = $2
         AND operational_status NOT IN ('CANCELLED','COMPLETED','JOB_COMPLETED')`,
      [id, req.user.tenant_id],
    );
    if (Number(check[0]?.count ?? 0) > 0) {
      throw new BadRequestException('City has active bookings and cannot be deactivated');
    }
    await this.dataSource.query(
      `UPDATE public.tenant_service_cities SET active = false WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    await this.dataSource.query(
      `UPDATE public.tenant_service_cities
       SET name = COALESCE($3, name),
           timezone = COALESCE($4, timezone),
           active = COALESCE($5, active)
       WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id, body.name, body.timezone, body.active],
    );
    return { success: true };
  }
}
