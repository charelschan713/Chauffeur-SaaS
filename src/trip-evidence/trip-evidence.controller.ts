/**
 * Admin-facing Trip Evidence Controller
 * All endpoints require ADMIN JWT. Strict tenant isolation enforced.
 */
import {
  Controller, Get, Post, Param, Res, UseGuards, HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TripEvidenceService } from './trip-evidence.service';
import { TripAuditService } from './trip-audit.service';

@Controller('admin/bookings/:bookingId/evidence')
@UseGuards(JwtGuard)
export class TripEvidenceController {
  constructor(
    private readonly evidenceSvc: TripEvidenceService,
    private readonly auditSvc: TripAuditService,
  ) {}

  /** Full evidence package — record + milestones + transcript + op log */
  @Get()
  getFullEvidence(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.evidenceSvc.getFullEvidence(tenantId, bookingId);
  }

  /** GPS milestones only */
  @Get('milestones')
  getMilestones(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.evidenceSvc.getMilestones(tenantId, bookingId);
  }

  /** SMS transcript only */
  @Get('transcript')
  getTranscript(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.evidenceSvc.getSmsTranscript(tenantId, bookingId);
  }

  /** Operation log only */
  @Get('operation-log')
  getOperationLog(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.evidenceSvc.getOperationLog(tenantId, bookingId);
  }

  /** Re-generate route image for this booking */
  @Post('route-image')
  @HttpCode(200)
  async regenerateRouteImage(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const url = await this.evidenceSvc.generateRouteImage(tenantId, bookingId);
    return { route_image_url: url };
  }

  /** Download PDF audit/evidence report */
  @Get('audit-report')
  async downloadAuditReport(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.auditSvc.generateReport(tenantId, bookingId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
