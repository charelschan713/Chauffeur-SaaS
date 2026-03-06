import { Module } from '@nestjs/common';
import { PricingResolver } from './pricing.resolver';
import { PricingController } from './pricing.controller';
import { ServiceTypeController } from './service-type.controller';
import { PricingProfileController } from './pricing-profile.controller';
import { ZoneResolver } from './resolvers/zone.resolver';
import { ItemResolver } from './resolvers/item.resolver';
import { MultiplierResolver } from './resolvers/multiplier.resolver';
import { AdjustmentResolver } from './resolvers/adjustment.resolver';
import { PricingService } from './pricing.service';
import { CustomerModule } from '../customer/customer.module';
import { MapsModule } from '../maps/maps.module';
import { SurchargeModule } from '../surcharge/surcharge.module';

@Module({
  imports: [CustomerModule, MapsModule, SurchargeModule],
  controllers: [PricingController, ServiceTypeController, PricingProfileController],
  providers: [
    PricingResolver,
    ZoneResolver,
    ItemResolver,
    MultiplierResolver,
    AdjustmentResolver,
    PricingService,
  ],
  exports: [PricingResolver, PricingService],
})
export class PricingModule {}
