import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Body,
  Post,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';
import { Request } from 'express';

@Controller('platform')
@UseGuards(JwtGuard)
export class PlatformController {
  constructor(private readonly dataSource: DataSource) {}

  private assertPlatformAdmin(req: Request) {
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin only');
    }
  }

  @Get('tenants')
  async listTenants(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.dataSource.query(
      `select id, name, slug, status, timezone, currency, created_at
         from public.tenants
         order by created_at desc`
    );
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string, @Req() req: Request) {
    this.assertPlatformAdmin(req);
    const rows = await this.dataSource.query(
      `select t.*,
              (select count(*) from public.memberships m where m.tenant_id = t.id) as member_count,
              (select count(*) from public.bookings b where b.tenant_id = t.id) as booking_count
         from public.tenants t
        where t.id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Tenant not found');
    return rows[0];
  }

  @Post('tenants')
  async createTenant(@Body() dto: any, @Req() req: Request) {
    this.assertPlatformAdmin(req);
    const rows = await this.dataSource.query(
      `insert into public.tenants (name, slug, timezone, currency, status)
         values ($1,$2,$3,$4,'active')
      returning *`,
      [dto.name, dto.slug, dto.timezone ?? 'UTC', dto.currency ?? 'AUD'],
    );
    return rows[0];
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(req);
    const allowed = ['active', 'suspended', 'archived'];
    if (!allowed.includes(status)) throw new BadRequestException('Invalid status');
    await this.dataSource.query(
      `update public.tenants set status = $1, updated_at = now() where id = $2`,
      [status, id],
    );
    return { success: true };
  }

  @Get('vehicles')
  async listVehicles(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.dataSource.query(
      `SELECT id, make, model, active, created_at
       FROM public.platform_vehicles
       WHERE active = true
       ORDER BY make, model ASC`,
    );
  }

  @Post('vehicles')
  async createVehicle(@Body() body: any, @Req() req: Request) {
    this.assertPlatformAdmin(req);
    const rows = await this.dataSource.query(
      `INSERT INTO public.platform_vehicles (make, model, active)
       VALUES ($1, $2, true)
       RETURNING id, make, model, active, created_at`,
      [body.make, body.model],
    );
    return rows[0];
  }

  @Patch('vehicles/:id')
  async updateVehicle(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    this.assertPlatformAdmin(req);
    const rows = await this.dataSource.query(
      `UPDATE public.platform_vehicles
       SET make = COALESCE($1, make),
           model = COALESCE($2, model),
           active = COALESCE($3, active)
       WHERE id = $4
       RETURNING id, make, model, active`,
      [body.make ?? null, body.model ?? null, body.active ?? null, id],
    );
    if (!rows.length) throw new NotFoundException('Vehicle not found');
    return rows[0];
  }


  @Get('drivers')
  async listDrivers(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.dataSource.query(
      `SELECT id, tenant_id, full_name, email
         FROM public.users
         WHERE role = 'DRIVER'
         ORDER BY created_at DESC`,
    );
  }

  @Get('customers')
  async listCustomers(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.dataSource.query(
      `SELECT id, tenant_id, first_name, last_name, email
         FROM public.customers
         ORDER BY created_at DESC`,
    );
  }

  @Get('bookings')
  async listBookings(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.dataSource.query(
      `SELECT id, tenant_id, booking_reference, operational_status, pickup_at_utc
         FROM public.bookings
         ORDER BY created_at DESC
         LIMIT 100`,
    );
  }
  @Get('metrics')
  async getMetrics(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    const metrics = await this.dataSource.query(
      `select
         (select count(*) from public.tenants where status = 'active') as active_tenants,
         (select count(*) from public.bookings where created_at > now() - interval '24 hours') as bookings_today,
         (select count(*) from public.bookings where operational_status = 'COMPLETED' and created_at > now() - interval '24 hours') as completed_today`
    );
    return metrics[0];
  }
}
