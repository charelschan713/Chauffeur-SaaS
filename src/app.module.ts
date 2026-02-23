import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ConstantsModule } from './modules/constants/constants.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { TenantsModule } from './modules/tenants/tenants.module';

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
    AdminModule,
    PublicApiModule,
    ConstantsModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
