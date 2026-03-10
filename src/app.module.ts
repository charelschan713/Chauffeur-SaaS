import { APP_INTERCEPTOR } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { PlatformModule } from './platform/platform.module';
import { DriverModule } from './driver/driver.module';
import { NetworkModule } from './network/network.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PublicModule } from './public/public.module';
import { InvoiceModule } from './invoice/invoice.module';
import { PricingModule } from './pricing/pricing.module';
import { HealthController } from './health/health.controller';
import { IntegrationModule } from './integration/integration.module';
import { NotificationModule } from './notification/notification.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { CityModule } from './city/city.module';
import { MapsModule } from './maps/maps.module';
import { CustomerModule } from './customer/customer.module';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { TenantBrandingModule } from './tenant-branding/tenant-branding.module';
import { DiscountModule } from './discount/discount.module';
import { SurchargeModule } from './surcharge/surcharge.module';
import { AssignmentModule } from './assignment/assignment.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { DebugModule } from './debug/debug.module';
import { TripEvidenceModule } from './trip-evidence/trip-evidence.module';
import { ProjectModule } from './project/project.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: false,
      synchronize: false,
      ssl: { rejectUnauthorized: false },
      extra: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
    }),
    EventEmitterModule.forRoot({ wildcard: true }),
    CommonModule,
    AuthModule,
    BookingModule,
    PaymentModule,
    DispatchModule,
    PlatformModule,
    DriverModule,
    NetworkModule,
    ReviewsModule,
    PublicModule,
    InvoiceModule,
    PricingModule,
    IntegrationModule,
    NotificationModule,
    VehicleModule,
    CityModule,
    MapsModule,
    CustomerModule,
    CustomerAuthModule,
    CustomerPortalModule,
    TenantBrandingModule,
    DiscountModule,
    SurchargeModule,
    AssignmentModule,
    TenantModule,
    TripEvidenceModule,
    ProjectModule,
    DebugModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude('auth/*path', 'webhooks/*path', 'health')
      .forRoutes('*');
  }
}
