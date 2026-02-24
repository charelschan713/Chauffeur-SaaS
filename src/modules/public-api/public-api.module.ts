import { Module } from '@nestjs/common';
import { PublicApiController, PublicOpenController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { QuoteCalculatorService } from './quote-calculator.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [PublicOpenController, PublicApiController],
  providers: [PublicApiService, QuoteCalculatorService],
})
export class PublicApiModule {}
