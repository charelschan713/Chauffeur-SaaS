import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TenantsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
