import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: false,
      synchronize: false,
      extra: { max: 10, statement_timeout: 10_000 },
    }),
    EventEmitterModule.forRoot({ wildcard: true }),
    JwtModule.register({}),
    AuthModule,
    BookingModule,
    PaymentModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude('auth/(.*)', 'webhooks/(.*)', 'health')
      .forRoutes('*');
  }
}
