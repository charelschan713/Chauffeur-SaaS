import { Module } from '@nestjs/common';
import { PublicApiController, PublicOpenController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { QuoteCalculatorService } from './quote-calculator.service';
import { PublicBookingsController } from './public-bookings.controller';
import { PublicBookingsService } from './public-bookings.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MapsModule } from '../maps/maps.module';
import { AirportsModule } from '../airports/airports.module';

@Module({
  imports: [TenantsModule, NotificationsModule, MapsModule, AirportsModule],
  controllers: [
    PublicOpenController,
    PublicApiController,
    PublicBookingsController,
    StripeWebhookController,
  ],
  providers: [PublicApiService, QuoteCalculatorService, PublicBookingsService],
})
export class PublicApiModule {}
