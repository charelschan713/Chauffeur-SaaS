import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';

import { IntegrationController } from './integration.controller';

@Module({
  providers: [EncryptionService, IntegrationResolver, IntegrationService],
  controllers: [IntegrationController],
  exports: [EncryptionService, IntegrationResolver, IntegrationService],
})
export class IntegrationModule {}
