import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { IntegrationModule } from '../integration/integration.module';
import { TemplateResolver } from './template.resolver';
import { NotificationTemplateController } from './notification-template.controller';

@Module({
  imports: [IntegrationModule],
  controllers: [NotificationTemplateController],
  providers: [NotificationService, EmailProvider, SmsProvider, TemplateResolver],
  exports: [NotificationService],
})
export class NotificationModule {}
