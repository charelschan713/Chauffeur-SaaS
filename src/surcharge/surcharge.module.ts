import { Module } from '@nestjs/common';
import { SurchargeService } from './surcharge.service';
import { SurchargeController } from './surcharge.controller';
import { AirportParkingService } from './airport-parking.service';

@Module({
  providers: [SurchargeService, AirportParkingService],
  controllers: [SurchargeController],
  exports: [SurchargeService, AirportParkingService],
})
export class SurchargeModule {}
