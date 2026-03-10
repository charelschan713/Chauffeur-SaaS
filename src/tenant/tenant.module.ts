import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantInvoiceService } from './tenant-invoice.service';

@Module({
  controllers: [TenantController],
  providers:   [TenantInvoiceService],
  exports:     [TenantInvoiceService],
})
export class TenantModule {}
