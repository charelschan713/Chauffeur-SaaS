import { Module } from '@nestjs/common';
import { GoogleMapsService } from './google-maps.service';
import { IntegrationModule } from '../integration/integration.module';
import { MapsController } from './maps.controller';

@Module({
  imports: [IntegrationModule],
  controllers: [MapsController],
  providers: [GoogleMapsService],
  exports: [GoogleMapsService],
})
export class MapsModule {}
