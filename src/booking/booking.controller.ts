import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { BookingService } from './booking.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtGuard)
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Get()
  async listBookings(
    @CurrentUser('tenant_id') tenantId: string,
    @Query() query: any,
  ) {
    try {
      return await this.service.listBookings(tenantId, query);
    } catch (e: any) {
      throw new (require('@nestjs/common').InternalServerErrorException)(e.message ?? 'listBookings failed');
    }
  }

  @Get(':id')
  getBooking(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getBookingDetail(tenantId, id);
  }

  @Post()
  createBooking(
    @CurrentUser('tenant_id') tenantId: string,
    @Body() dto: any,
  ) {
    return this.service.createBooking(tenantId, dto);
  }

  @Patch(':id/transition')
  transition(
    @Param('id') bookingId: string,
    @Body() dto: any,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.transition(
      bookingId,
      dto.newStatus,
      userId,
      dto.reason,
    );
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.cancelBooking(tenantId, bookingId, userId);
  }

  @Post(':id/mark-paid')
  markPaid(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.markPaid(tenantId, bookingId);
  }

  @Post(':id/send-payment-link')
  sendPaymentLink(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.sendPaymentLink(tenantId, bookingId);
  }

  /** Re-fires InvoiceSent notification for the most recent SENT/PAID CUSTOMER invoice */
  @Post(':id/resend-invoice')
  resendInvoice(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.resendInvoice(tenantId, bookingId);
  }

  /** Admin-side download of the final invoice PDF */
  @Get(':id/invoice-pdf')
  async downloadInvoicePdfAdmin(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Res() res: Response,
  ) {
    const result = await this.service.getInvoicePdfForAdmin(tenantId, bookingId);
    if (!result) throw new NotFoundException('No final invoice found for this booking');
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length':      result.buffer.length,
      'Cache-Control':       'no-store',
    });
    res.end(result.buffer);
  }

  /** Phase 2: Admin endpoint — get driver execution report for a booking */
  @Get(':id/driver-report')
  getDriverReport(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.getDriverExtraReportForAdmin(tenantId, bookingId);
  }

  @Post(':id/fulfil')
  fulfil(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Body() body: { extra_amount_minor?: number; note?: string },
  ) {
    return this.service.fulfilBooking(tenantId, bookingId, adminId, body);
  }

  @Post(':id/charge')
  chargeNow(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.chargeNow(tenantId, bookingId);
  }

  @Post(':id/confirm-and-charge')
  confirmAndCharge(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.confirmAndCharge(tenantId, bookingId);
  }

  @Post(':id/reject')
  rejectBooking(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.service.rejectBooking(tenantId, bookingId, body.reason);
  }

  @Post(':id/finalize')
  finalizeBooking(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Body() body: any,
  ) {
    return this.service.finalizeBooking(tenantId, bookingId, adminId, body);
  }

  @Post(':id/settle')
  settleBooking(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Body() body: any,
  ) {
    return this.service.settleBooking(tenantId, bookingId, adminId, body);
  }
}
