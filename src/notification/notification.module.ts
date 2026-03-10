import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { IntegrationModule } from '../integration/integration.module';
import { TemplateResolver } from './template.resolver';
import { NotificationTemplateController } from './notification-template.controller';
import { Reflector } from '@nestjs/core';
import { TenantRoleGuard } from '../common/guards/tenant-role.guard';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [IntegrationModule, InvoiceModule],
  controllers: [NotificationTemplateController],
  providers: [NotificationService, EmailProvider, SmsProvider, TemplateResolver, Reflector, TenantRoleGuard],
  exports: [NotificationService],
})
export class NotificationModule {}
