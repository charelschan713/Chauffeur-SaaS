import { Module } from '@nestjs/common';
import { TenantVehiclesController } from './tenant-vehicles.controller';
import { TenantVehiclesService } from './tenant-vehicles.service';

@Module({
  controllers: [TenantVehiclesController],
  providers: [TenantVehiclesService],
  exports: [TenantVehiclesService],
})
export class TenantVehiclesModule {}
