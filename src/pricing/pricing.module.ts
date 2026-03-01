import { Module } from '@nestjs/common';
import { PricingResolver } from './pricing.resolver';
import { PricingController } from './pricing.controller';
import { ZoneResolver } from './resolvers/zone.resolver';
import { ItemResolver } from './resolvers/item.resolver';
import { MultiplierResolver } from './resolvers/multiplier.resolver';
import { AdjustmentResolver } from './resolvers/adjustment.resolver';

@Module({
  controllers: [PricingController],
  providers: [
    PricingResolver,
    ZoneResolver,
    ItemResolver,
    MultiplierResolver,
    AdjustmentResolver,
  ],
  exports: [PricingResolver],
})
export class PricingModule {}
