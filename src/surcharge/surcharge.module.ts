import { Module } from '@nestjs/common';
import { SurchargeService } from './surcharge.service';
import { SurchargeController } from './surcharge.controller';

@Module({
  providers: [SurchargeService],
  controllers: [SurchargeController],
  exports: [SurchargeService],
})
export class SurchargeModule {}
