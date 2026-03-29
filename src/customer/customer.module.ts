import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { PassengerController } from './passenger.controller';
import { DiscountResolver } from './discount.resolver';
import { NotificationModule } from '../notification/notification.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [NotificationModule, LoyaltyModule],
  controllers: [CustomerController, PassengerController],
  providers: [DiscountResolver],
  exports: [DiscountResolver],
})
export class CustomerModule {}
