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
import { AdminDriverController, AdminDriverPayController } from './admin-driver.controller';
import { AdminDriverService } from './admin-driver.service';
import { TripEvidenceModule } from '../trip-evidence/trip-evidence.module';

@Module({
  imports: [JwtModule.register({}), NetworkModule, NotificationModule, TripEvidenceModule],
  controllers: [
    DriverController, DriverAppController,
    DriverInviteController, DriverOnboardingController,
    AdminDriverController, AdminDriverPayController,
  ],
  providers: [DriverService, DriverAppService, DriverInviteService, AdminDriverService],
  exports: [DriverAppService, AdminDriverService],
})
export class DriverModule {}
