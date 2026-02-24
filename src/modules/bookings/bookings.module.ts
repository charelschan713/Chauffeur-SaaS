import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingTransferService } from './booking-transfer.service';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [NotificationsModule, WebhooksModule, CrmModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingTransferService],
  exports: [BookingsService, BookingTransferService],
})
export class BookingsModule {}
