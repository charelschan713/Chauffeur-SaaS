import { Body, Controller, Delete, Get, Patch, Post, UseGuards, Param, Req, Query } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { VehicleService } from './vehicle.service';

@Controller('vehicles')
@UseGuards(JwtGuard)
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get()
  async list(@Req() req: any) {
    return this.vehicles.listTenantVehicles(req.user.tenant_id);
  }

  @Get('platform-vehicles')
  async listPlatform() {
    return this.vehicles.listPlatformVehicles();
  }

  @Get('assignable')
  async getAssignable(@Query('car_type_id') carTypeId: string, @Req() req: any) {
    return this.vehicles.listAssignable(req.user.tenant_id, carTypeId);
  }

  @Post()
  async claim(@Body() body: any, @Req() req: any) {
    return this.vehicles.claimVehicle(req.user.tenant_id, body.platform_vehicle_id, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.vehicles.updateTenantVehicle(req.user.tenant_id, id, body);
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string, @Req() req: any) {
    return this.vehicles.deactivateTenantVehicle(req.user.tenant_id, id);
  }
}
