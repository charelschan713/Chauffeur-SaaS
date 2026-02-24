import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ConstantsModule } from './modules/constants/constants.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { PlatformVehiclesModule } from './modules/platform-vehicles/platform-vehicles.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { VehicleTypesModule } from './modules/vehicle-types/vehicle-types.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CrmModule } from './modules/crm/crm.module';
import { ServiceTypesModule } from './modules/service-types/service-types.module';
import { SurchargesModule } from './modules/surcharges/surcharges.module';
import { TenantVehiclesModule } from './modules/vehicles/tenant-vehicles.module';
import { MapsModule } from './modules/maps/maps.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    TenantsModule,
    DriversModule,
    BookingsModule,
    PricingModule,
    PaymentsModule,
    NotificationsModule,
    InvoicesModule,
    ConnectionsModule,
    AdminModule,
    PublicApiModule,
    ConstantsModule,
    ApiKeysModule,
    PlatformVehiclesModule,
    VehicleTypesModule,
    WebhooksModule,
    CrmModule,
    ServiceTypesModule,
    SurchargesModule,
    TenantVehiclesModule,
    MapsModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
