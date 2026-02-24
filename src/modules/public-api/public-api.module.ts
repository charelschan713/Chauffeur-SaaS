import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { QuoteCalculatorService } from './quote-calculator.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [PublicApiController],
  providers: [PublicApiService, QuoteCalculatorService],
})
export class PublicApiModule {}
