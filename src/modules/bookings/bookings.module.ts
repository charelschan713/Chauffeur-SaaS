import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [NotificationsModule, WebhooksModule, CrmModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
