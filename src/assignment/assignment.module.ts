import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { NotificationModule } from '../notification/notification.module';
import { TenantPermissionsService } from '../common/tenant-permissions.service';

@Module({
  imports: [NotificationModule],
  providers: [AssignmentService, TenantPermissionsService],
  controllers: [AssignmentController],
})
export class AssignmentModule {}
