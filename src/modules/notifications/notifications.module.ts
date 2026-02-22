import { forwardRef, Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [forwardRef(() => TenantsModule)],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
