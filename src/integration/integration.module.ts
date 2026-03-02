import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IntegrationResolver } from './integration.resolver';

@Module({
  providers: [EncryptionService, IntegrationResolver],
  exports: [EncryptionService, IntegrationResolver],
})
export class IntegrationModule {}
