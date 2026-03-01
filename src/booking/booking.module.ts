import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { OutboxWorkerService } from './outbox-worker.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  providers: [BookingService, OutboxWorkerService],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
