import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { OutboxWorkerService } from './outbox-worker.service';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PricingModule, NotificationModule],
  providers: [BookingService, OutboxWorkerService],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
