import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    TenantsModule,
    DriversModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
  ],
})
export class AppModule {}
