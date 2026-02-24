import { Module } from '@nestjs/common';
import { AirportsController } from './airports.controller';
import { PlatformAirportsService } from './platform-airports.service';
import { TenantAirportFeesService } from './tenant-airport-fees.service';

@Module({
  controllers: [AirportsController],
  providers: [PlatformAirportsService, TenantAirportFeesService],
  exports: [PlatformAirportsService, TenantAirportFeesService],
})
export class AirportsModule {}
