import { Global, Module } from '@nestjs/common';
import { DebugTraceService } from './debug-trace.service';

@Global()
@Module({
  providers: [DebugTraceService],
  exports: [DebugTraceService],
})
export class DebugModule {}
