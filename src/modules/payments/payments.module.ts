import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [NotificationsModule, TenantsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
