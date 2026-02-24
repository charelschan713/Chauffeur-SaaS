import { Module } from '@nestjs/common';
import { VehicleTypesController } from './vehicle-types.controller';
import { VehicleTypesService } from './vehicle-types.service';
import { VehicleTypeExtrasService } from './vehicle-type-extras.service';

@Module({
  controllers: [VehicleTypesController],
  providers: [VehicleTypesService, VehicleTypeExtrasService],
  exports: [VehicleTypesService, VehicleTypeExtrasService],
})
export class VehicleTypesModule {}
