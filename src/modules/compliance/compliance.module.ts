import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { ComplianceCron } from './compliance.cron';

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceCron],
  exports: [ComplianceService],
})
export class ComplianceModule {}
