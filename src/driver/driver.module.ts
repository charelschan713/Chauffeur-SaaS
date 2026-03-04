import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { DriverAppController } from './driver-app.controller';
import { DriverAppService } from './driver-app.service';
import { DriverInviteController, DriverOnboardingController } from './driver-invite.controller';
import { DriverInviteService } from './driver-invite.service';
import { NetworkModule } from '../network/network.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [JwtModule.register({}), NetworkModule, NotificationModule],
  controllers: [DriverController, DriverAppController, DriverInviteController, DriverOnboardingController],
  providers: [DriverService, DriverAppService, DriverInviteService],
})
export class DriverModule {}
