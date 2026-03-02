import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IntegrationResolver } from './integration.resolver';

import { IntegrationController } from './integration.controller';

@Module({
  providers: [EncryptionService, IntegrationResolver],
  controllers: [IntegrationController],
  exports: [EncryptionService, IntegrationResolver],
})
export class IntegrationModule {}
