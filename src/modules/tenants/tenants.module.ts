import { forwardRef, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApiTokensService } from './api-tokens.service';
import { ServiceCitiesService } from './service-cities.service';
import { TenantKeysService } from './tenant-keys.service';
import { TenantsController } from './tenants.controller';
import { TenantsPublicController } from './tenants-public.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [TenantsController, TenantsPublicController],
  providers: [
    TenantsService,
    TenantKeysService,
    ApiTokensService,
    ServiceCitiesService,
  ],
  exports: [
    TenantsService,
    TenantKeysService,
    ApiTokensService,
    ServiceCitiesService,
  ],
})
export class TenantsModule {}
