import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriverInvitationsController } from './driver-invitations.controller';
import { DriverInvitationsService } from './driver-invitations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DriverInvitationsController],
  providers: [DriverInvitationsService],
  exports: [DriverInvitationsService],
})
export class DriverInvitationsModule {}
