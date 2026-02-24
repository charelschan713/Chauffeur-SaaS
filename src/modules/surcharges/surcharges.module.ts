import { Module } from '@nestjs/common';
import { SurchargesController } from './surcharges.controller';
import { SurchargesService } from './surcharges.service';
import { QuoteCalculatorService } from '../public-api/quote-calculator.service';

@Module({
  controllers: [SurchargesController],
  providers: [SurchargesService, QuoteCalculatorService],
  exports: [SurchargesService, QuoteCalculatorService],
})
export class SurchargesModule {}
