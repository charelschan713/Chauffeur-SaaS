import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingTransferService } from './booking-transfer.service';
import { BookingTransferController } from './booking-transfer.controller';
import { CrmModule } from '../crm/crm.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [NotificationsModule, WebhooksModule, CrmModule, ComplianceModule],
  controllers: [BookingsController, BookingTransferController],
  providers: [BookingsService, BookingTransferService],
  exports: [BookingsService, BookingTransferService],
})
export class BookingsModule {}
