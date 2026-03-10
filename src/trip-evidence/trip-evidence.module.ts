import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TripEvidenceService } from './trip-evidence.service';
import { TripSmsService } from './trip-sms.service';
import { TripAuditService } from './trip-audit.service';
import { TripEvidenceController } from './trip-evidence.controller';
import { TripDriverController } from './trip-driver.controller';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [JwtModule.register({}), IntegrationModule],
  controllers: [
    TripEvidenceController,
    TripDriverController,
    TwilioWebhookController,
  ],
  providers: [TripEvidenceService, TripSmsService, TripAuditService],
  exports:   [TripEvidenceService, TripSmsService],
})
export class TripEvidenceModule {}
