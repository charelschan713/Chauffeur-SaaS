import { forwardRef, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantKeysService } from './tenant-keys.service';
import { TenantsController } from './tenants.controller';
import { TenantsPublicController } from './tenants-public.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [TenantsController, TenantsPublicController],
  providers: [TenantsService, TenantKeysService],
  exports: [TenantsService, TenantKeysService],
})
export class TenantsModule {}
