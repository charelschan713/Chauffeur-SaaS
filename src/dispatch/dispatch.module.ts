import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DispatchTimeoutWorker } from './dispatch-timeout.worker';
import { DispatchEventListener } from './dispatch-event.listener';

@Module({
  imports: [],
  controllers: [DispatchController],
  providers: [DispatchService, DispatchTimeoutWorker, DispatchEventListener],
  exports: [DispatchService],
})
export class DispatchModule {}
