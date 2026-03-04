import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { DriverAppController } from './driver-app.controller';
import { DriverAppService } from './driver-app.service';
import { NetworkModule } from '../network/network.module';

@Module({
  imports: [JwtModule.register({}), NetworkModule],
  controllers: [DriverController, DriverAppController],
  providers: [DriverService, DriverAppService],
})
export class DriverModule {}
