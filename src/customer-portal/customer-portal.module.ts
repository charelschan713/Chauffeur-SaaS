import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { DiscountModule } from '../discount/discount.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [JwtModule.register({}), CustomerAuthModule, DiscountModule, NotificationModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
})
export class CustomerPortalModule {}
