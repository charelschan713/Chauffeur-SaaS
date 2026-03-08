import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { PassengerController } from './passenger.controller';
import { DiscountResolver } from './discount.resolver';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [CustomerController, PassengerController],
  providers: [DiscountResolver],
  exports: [DiscountResolver],
})
export class CustomerModule {}
