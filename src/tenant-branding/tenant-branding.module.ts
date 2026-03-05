import { Module } from '@nestjs/common';
import { TenantBrandingController } from './tenant-branding.controller';

@Module({
  controllers: [TenantBrandingController],
})
export class TenantBrandingModule {}
