import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantRoleGuard } from '../common/guards/tenant-role.guard';
import { SurchargeService } from './surcharge.service';
import { AirportParkingService } from './airport-parking.service';

@Controller('surcharges')
@UseGuards(JwtGuard)
export class SurchargeController {
  constructor(
    private readonly svc: SurchargeService,
    private readonly parking: AirportParkingService,
  ) {}

  private tenantId(req: any): string {
    return req.user?.tenantId ?? req.user?.tenant_id;
  }

  // ── Time Surcharges ─────────────────────────────────────────────

  @Get('time')
  listTime(@Req() req: any) {
    return this.svc.listTimeSurcharges(this.tenantId(req));
  }

  @Post('time')
  @UseGuards(TenantRoleGuard)
  createTime(@Req() req: any, @Body() body: any) {
    return this.svc.createTimeSurcharge(this.tenantId(req), body);
  }

  @Put('time/:id')
  @UseGuards(TenantRoleGuard)
  updateTime(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateTimeSurcharge(this.tenantId(req), id, body);
  }

  @Delete('time/:id')
  @UseGuards(TenantRoleGuard)
  deleteTime(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteTimeSurcharge(this.tenantId(req), id);
  }

  // ── Public Holidays ─────────────────────────────────────────────

  @Get('holidays')
  listHolidays(@Req() req: any) {
    return this.svc.listHolidays(this.tenantId(req));
  }

  @Post('holidays')
  @UseGuards(TenantRoleGuard)
  createHoliday(@Req() req: any, @Body() body: any) {
    return this.svc.createHoliday(this.tenantId(req), body);
  }

  @Put('holidays/:id')
  @UseGuards(TenantRoleGuard)
  updateHoliday(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateHoliday(this.tenantId(req), id, body);
  }

  @Delete('holidays/:id')
  @UseGuards(TenantRoleGuard)
  deleteHoliday(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteHoliday(this.tenantId(req), id);
  }

  // ── Airport Parking ───────────────────────────────────────────────────────
  @Get('parking')
  listParking(@Req() req: any) {
    return this.parking.list(this.tenantId(req));
  }

  @Post('parking')
  @UseGuards(TenantRoleGuard)
  createParking(@Req() req: any, @Body() body: any) {
    return this.parking.create(this.tenantId(req), body);
  }

  @Put('parking/:id')
  @UseGuards(TenantRoleGuard)
  updateParking(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.parking.update(this.tenantId(req), id, body);
  }

  @Delete('parking/:id')
  @UseGuards(TenantRoleGuard)
  deleteParking(@Req() req: any, @Param('id') id: string) {
    return this.parking.remove(this.tenantId(req), id);
  }
}
