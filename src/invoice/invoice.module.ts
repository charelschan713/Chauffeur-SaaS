import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  controllers: [InvoiceController],
  providers: [InvoicePdfService],
  exports: [InvoicePdfService],
})
export class InvoiceModule {}
