import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { PassengerController } from './passenger.controller';
import { DiscountResolver } from './discount.resolver';

@Module({
  controllers: [CustomerController, PassengerController],
  providers: [DiscountResolver],
  exports: [DiscountResolver],
})
export class CustomerModule {}
