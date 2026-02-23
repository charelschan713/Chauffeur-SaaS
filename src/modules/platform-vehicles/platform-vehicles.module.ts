import { Module } from '@nestjs/common';
import { PlatformVehiclesController } from './platform-vehicles.controller';
import { PlatformVehiclesService } from './platform-vehicles.service';

@Module({
  controllers: [PlatformVehiclesController],
  providers: [PlatformVehiclesService],
  exports: [PlatformVehiclesService],
})
export class PlatformVehiclesModule {}
