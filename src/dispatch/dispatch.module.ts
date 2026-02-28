import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DispatchTimeoutWorker } from './dispatch-timeout.worker';
import { DispatchEventListener } from './dispatch-event.listener';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [BookingModule],
  controllers: [DispatchController],
  providers: [DispatchService, DispatchTimeoutWorker, DispatchEventListener],
  exports: [DispatchService],
})
export class DispatchModule {}
