import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';

@Controller('service-types')
@UseGuards(JwtGuard)
export class ServiceTypeController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT id, code, display_name, booking_flow, active
       FROM public.tenant_service_types
       WHERE tenant_id = $1 AND active = true
       ORDER BY code ASC`,
      [req.user.tenant_id],
    );
  }
}
