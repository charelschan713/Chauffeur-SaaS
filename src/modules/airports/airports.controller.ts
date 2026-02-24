import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformAirportsService } from './platform-airports.service';
import { TenantAirportFeesService } from './tenant-airport-fees.service';

@Controller()
export class AirportsController {
  constructor(
    private readonly airportsService: PlatformAirportsService,
    private readonly tenantFeesService: TenantAirportFeesService,
  ) {}

  @Get('tenant-airport-fees')
  @UseGuards(JwtGuard)
  async getTenantFees(@Request() req: any) {
    return this.tenantFeesService.getByTenant(req.user.profile.tenant_id);
  }

  @Patch('tenant-airport-fees/:airport_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  async upsertTenantFee(@Request() req: any, @Param('airport_id') airport_id: string, @Body() body: any) {
    return this.tenantFeesService.upsert(
      req.user.profile.tenant_id,
      airport_id,
      Number(body.parking_fee ?? 0),
      body.is_active ?? true,
    );
  }

  @Get('admin/airports')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.airportsService.findAll(includeInactive === 'true');
  }

  @Post('admin/airports')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  create(@Body() dto: any) {
    return this.airportsService.create(dto);
  }

  @Patch('admin/airports/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.airportsService.update(id, dto);
  }
}
