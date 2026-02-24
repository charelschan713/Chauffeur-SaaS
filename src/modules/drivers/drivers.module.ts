import { Module } from '@nestjs/common';
import { DriverInvitationsModule } from '../driver-invitations/driver-invitations.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [DriverInvitationsModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
