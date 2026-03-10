import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports:     [TenantModule],
  controllers: [InvoiceController],
  providers:   [InvoicePdfService],
  exports:     [InvoicePdfService],
})
export class InvoiceModule {}
