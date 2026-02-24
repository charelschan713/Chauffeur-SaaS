import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ComplianceService } from './compliance.service';

@Injectable()
export class ComplianceCron {
  constructor(private readonly complianceService: ComplianceService) {}

  @Cron('0 9 * * *')
  async runDailyComplianceCheck() {
    await this.complianceService.expireDocuments();
    await this.complianceService.sendExpiryWarnings();
  }
}
