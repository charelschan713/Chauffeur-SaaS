import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PublicController } from './public.controller';
import { PublicTenantService } from './public-tenant.service';
import { PublicMapsService } from './public-maps.service';
import { PublicPricingService } from './public-pricing.service';
import { MapsModule } from '../maps/maps.module';
import { PricingModule } from '../pricing/pricing.module';
import { DiscountModule } from '../discount/discount.module';

@Module({
  imports: [MapsModule, PricingModule, DiscountModule,
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
  controllers: [PublicController],
  providers: [PublicTenantService, PublicMapsService, PublicPricingService],
  exports: [PublicTenantService],
})
export class PublicModule {}
