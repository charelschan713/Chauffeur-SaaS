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
import { PricingModule } from './pricing/pricing.module';
import { HealthController } from './health/health.controller';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

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
    PricingModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude('auth/*path', 'webhooks/*path', 'health')
      .forRoutes('*');
  }
}
