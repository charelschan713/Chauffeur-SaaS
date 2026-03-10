import {
  Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { AdminDriverService } from './admin-driver.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/driver-invoices')
@UseGuards(JwtGuard)
export class AdminDriverController {
  constructor(private readonly svc: AdminDriverService) {}

  /** List all driver invoices for this tenant */
  @Get()
  list(
    @CurrentUser('tenant_id') tenantId: string,
    @Query('driver_id') driverId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listDriverInvoices(tenantId, { driver_id: driverId, status });
  }

  /** Get single driver invoice with line items */
  @Get(':id')
  detail(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getDriverInvoice(tenantId, id);
  }

  /** Mark driver invoice paid (offline payment confirmed) */
  @Patch(':id/mark-paid')
  markPaid(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.svc.markDriverInvoicePaid(tenantId, id, adminId, body);
  }

  /** Dispute a driver invoice */
  @Patch(':id/dispute')
  dispute(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() body: { dispute_reason: string },
  ) {
    return this.svc.disputeDriverInvoice(tenantId, id, adminId, body);
  }
}

// ── Admin: driver pay review (per booking/assignment) ─────────────────────────

@Controller('bookings')
@UseGuards(JwtGuard)
export class AdminDriverPayController {
  constructor(private readonly svc: AdminDriverService) {}

  /** Admin confirms final driver payable for a booking's assignment */
  @Post(':bookingId/driver-pay-review')
  reviewPay(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: any,
  ) {
    return this.svc.reviewDriverPay(tenantId, bookingId, adminId, body);
  }

  /** Get admin driver pay review for a booking */
  @Get(':bookingId/driver-pay-review')
  getReview(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.svc.getDriverPayReview(tenantId, bookingId);
  }
}
