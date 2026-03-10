import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { LoyaltyPricingService } from './loyalty-pricing.service';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [JwtModule.register({}), CustomerAuthModule, NotificationModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService, LoyaltyPricingService],
})
export class CustomerPortalModule {}
