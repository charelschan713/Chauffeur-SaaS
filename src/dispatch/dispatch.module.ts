import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DispatchTimeoutWorker } from './dispatch-timeout.worker';
import { DispatchEventListener } from './dispatch-event.listener';
import { BookingModule } from '../booking/booking.module';
import { EligibilityResolver } from './eligibility/eligibility.resolver';
import { DriverModule } from '../driver/driver.module';

@Module({
  imports: [BookingModule, DriverModule],
  controllers: [DispatchController],
  providers: [
    DispatchService,
    DispatchTimeoutWorker,
    DispatchEventListener,
    EligibilityResolver,
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
