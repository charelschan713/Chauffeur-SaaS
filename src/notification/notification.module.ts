import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [IntegrationModule],
  providers: [NotificationService, EmailProvider, SmsProvider],
  exports: [NotificationService],
})
export class NotificationModule {}
