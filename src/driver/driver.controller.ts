import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DriverService } from './driver.service';

class UpdateDriverStatusDto {
  availability_status!: string;
}

@UseGuards(JwtGuard)
@Controller('drivers')
export class DriverController {
  constructor(private readonly drivers: DriverService) {}

  @Get()
  async listDrivers(
    @CurrentUser('tenant_id') tenantId: string,
    @Query('search') search?: string,
    @Query('availability_status') availabilityStatus?: string,
  ) {
    return this.drivers.listDrivers(tenantId, {
      search,
      availabilityStatus,
    });
  }

  @Get('available')
  async listAvailable(@CurrentUser('tenant_id') tenantId: string) {
    return this.drivers.listDrivers(tenantId, {
      availabilityStatus: 'AVAILABLE',
    });
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
    @Body('availability_status') status: string,
  ) {
    if (!status) throw new BadRequestException('status is required');
    return this.drivers.updateStatus(tenantId, driverId, status);
  }
}
