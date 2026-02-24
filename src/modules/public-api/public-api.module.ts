import { Module } from '@nestjs/common';
import { PublicApiController, PublicOpenController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { QuoteCalculatorService } from './quote-calculator.service';
import { PublicBookingsController } from './public-bookings.controller';
import { PublicBookingsService } from './public-bookings.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [PublicOpenController, PublicApiController, PublicBookingsController],
  providers: [PublicApiService, QuoteCalculatorService, PublicBookingsService],
})
export class PublicApiModule {}
