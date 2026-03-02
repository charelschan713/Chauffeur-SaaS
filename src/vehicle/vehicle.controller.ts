import { Body, Controller, Get, Patch, Post, UseGuards, Param, Req } from '@nestjs/common';
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

  @Post()
  async claim(@Body('platformVehicleId') platformVehicleId: string, @Req() req: any) {
    return this.vehicles.claimVehicle(req.user.tenant_id, platformVehicleId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.vehicles.updateTenantVehicle(req.user.tenant_id, id, body);
  }
}
