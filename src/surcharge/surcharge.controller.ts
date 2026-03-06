import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRoleGuard } from '../common/guards/tenant-role.guard';
import { SurchargeService } from './surcharge.service';

@Controller('surcharges')
@UseGuards(JwtAuthGuard)
export class SurchargeController {
  constructor(private readonly svc: SurchargeService) {}

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
}
