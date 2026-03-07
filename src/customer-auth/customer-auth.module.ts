import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [JwtModule.register({}), NotificationModule],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
