import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DriverAppService } from './driver-app.service';
import { NetworkService } from '../network/network.service';

/**
 * Driver App REST API
 * Base: /driver-app
 * Auth: Bearer JWT (same token as admin, driver role)
 */
@UseGuards(JwtGuard)
@Controller('driver-app')
export class DriverAppController {
  constructor(
    private readonly service: DriverAppService,
    private readonly network: NetworkService,
  ) {}

  /** Driver profile (who am I) */
  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    return this.service.getMe(userId);
  }

  /** Dashboard: today/upcoming jobs + stats */
  @Get('dashboard')
  async dashboard(@CurrentUser('sub') userId: string) {
    return this.service.getDashboard(userId);
  }

  /** List assignments: ?filter=active|upcoming|completed|all */
  @Get('assignments')
  async listAssignments(
    @CurrentUser('sub') userId: string,
    @Query('filter') filter?: string,
  ) {
    return this.service.listAssignments(userId, filter);
  }

  /** Single assignment with full booking detail */
  @Get('assignments/:id')
  async getAssignment(
    @CurrentUser('sub') userId: string,
    @Param('id') assignmentId: string,
  ) {
    return this.service.getAssignment(userId, assignmentId);
  }

  /**
   * Update job execution status
   * Body: { new_status, location?: {lat, lng}, remarks? }
   */
  @Patch('assignments/:id/status')
  async updateStatus(
    @CurrentUser('sub') userId: string,
    @Param('id') assignmentId: string,
    @Body() body: {
      new_status: string;
      location?: { lat: number; lng: number };
      remarks?: string;
    },
  ) {
    return this.service.updateExecutionStatus(
      userId,
      assignmentId,
      body.new_status,
      body.location,
      body.remarks,
    );
  }

  /** Location ping */
  @Post('location')
  async updateLocation(
    @CurrentUser('sub') userId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.service.updateLocation(userId, body.lat, body.lng);
  }

  /**
   * Driver unbinds themselves from current tenant
   * Body: { reason? }
   */
  @Post('unbind')
  async selfUnbind(
    @CurrentUser('sub') userId: string,
    @Body('reason') reason?: string,
  ) {
    return this.service.selfUnbind(userId, reason);
  }

  // ─── External Order Approval ──────────────────────────────────────────────

  /** Get driver's external approval status */
  @Get('external-approval')
  async externalApprovalStatus(@CurrentUser('sub') userId: string) {
    return this.network.getExternalApprovalStatus(userId);
  }

  /** Apply to receive external orders (needs platform review) */
  @Post('external-approval/apply')
  async applyExternalApproval(
    @CurrentUser('sub') userId: string,
    @Body('reason') reason?: string,
  ) {
    return this.network.applyExternalApproval(userId, reason);
  }

  /** Save APNs / FCM push token */
  @Post('apns-token')
  async saveApnsToken(
    @CurrentUser('sub') userId: string,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.service.saveApnsToken(userId, body.token, body.platform);
  }

  /** Submit post-job extras report */
  @Post('extra-report')
  async submitExtraReport(
    @CurrentUser('sub') driverId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Body() body: {
      assignment_id: string;
      extra_waypoints?: string[];
      waiting_minutes?: number;
      extra_toll?: number;
      extra_parking?: number;
      notes?: string;
    },
  ) {
    return this.service.submitExtraReport(driverId, tenantId, body);
  }

  /** Get extras report for an assignment */
  @Get('extra-report/:assignmentId')
  async getExtraReport(
    @CurrentUser('sub') driverId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.service.getExtraReport(driverId, assignmentId);
  }

  // ─── Banking / Profile ────────────────────────────────────────────────────

  /** Update driver banking details */
  @Patch('me/banking')
  async updateBanking(
    @CurrentUser('sub') driverId: string,
    @Body() body: {
      abn?: string;
      bank_bsb?: string;
      bank_account?: string;
      bank_name?: string;
      is_gst_registered?: boolean;
    },
  ) {
    return this.service.updateBanking(driverId, body);
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────

  /** List driver's invoices */
  @Get('invoices')
  async listInvoices(@CurrentUser('sub') driverId: string) {
    return this.service.listDriverInvoices(driverId);
  }

  /** Completed assignments not yet invoiced */
  @Get('invoices/invoiceable')
  async invoiceableJobs(@CurrentUser('sub') driverId: string) {
    return this.service.getInvoiceableJobs(driverId);
  }

  /** Create a draft invoice */
  @Post('invoices')
  async createInvoice(
    @CurrentUser('sub') driverId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Body('assignment_ids') assignmentIds: string[],
  ) {
    return this.service.createDriverInvoice(driverId, tenantId, assignmentIds);
  }

  /** Submit invoice to admin */
  @Patch('invoices/:id/submit')
  async submitInvoice(
    @CurrentUser('sub') driverId: string,
    @Param('id') invoiceId: string,
  ) {
    return this.service.submitDriverInvoice(driverId, invoiceId);
  }

  /** Verify ABN via ABR */
  @Post('verify-abn')
  async verifyAbn(@Body('abn') abn: string) {
    return this.service.verifyAbn(abn);
  }
}
