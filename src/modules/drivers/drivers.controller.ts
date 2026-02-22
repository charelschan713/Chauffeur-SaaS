import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompleteDriverProfileDto } from './dto/complete-driver-profile.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  // ── 司机自己的路由 ──

  @Get('me')
  @Roles('DRIVER')
  getMyProfile(@Request() req: any) {
    return this.driversService.getMyProfile(req.user.id);
  }

  @Post('me/profile')
  @Roles('DRIVER')
  completeProfile(@Body() dto: CompleteDriverProfileDto, @Request() req: any) {
    return this.driversService.completeProfile(
      req.user.id,
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Patch('me/availability')
  @Roles('DRIVER')
  toggleAvailability(
    @Body('is_available') is_available: boolean,
    @Request() req: any,
  ) {
    return this.driversService.toggleAvailability(req.user.id, is_available);
  }

  @Get('me/vehicles')
  @Roles('DRIVER')
  getMyVehicles(@Request() req: any) {
    return this.driversService.getMyVehicles(req.user.id);
  }

  @Post('me/vehicles')
  @Roles('DRIVER')
  addVehicle(@Body() dto: CreateVehicleDto, @Request() req: any) {
    return this.driversService.addVehicle(
      req.user.id,
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Delete('me/vehicles/:vehicle_id')
  @Roles('DRIVER')
  deactivateVehicle(@Param('vehicle_id') vehicle_id: string, @Request() req: any) {
    return this.driversService.deactivateVehicle(vehicle_id, req.user.id);
  }

  // ── 租户管理路由 ──

  @Get()
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  findAll(@Request() req: any, @Query('status') status?: string) {
    return this.driversService.findAllByTenant(
      req.user.profile.tenant_id,
      status,
    );
  }

  @Get(':driver_id')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  findOne(@Param('driver_id') driver_id: string, @Request() req: any) {
    return this.driversService.findOne(driver_id, req.user.profile.tenant_id);
  }

  @Patch(':driver_id/status')
  @Roles('TENANT_ADMIN')
  updateStatus(
    @Param('driver_id') driver_id: string,
    @Body() dto: UpdateDriverStatusDto,
    @Request() req: any,
  ) {
    return this.driversService.updateStatus(
      driver_id,
      req.user.profile.tenant_id,
      dto,
    );
  }
}
