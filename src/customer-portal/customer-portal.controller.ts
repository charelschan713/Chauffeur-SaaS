import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CustomerPortalService } from './customer-portal.service';
import { LoyaltyPricingService } from './loyalty-pricing.service';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('customer-portal')
export class CustomerPortalController {
  constructor(
    private readonly svc: CustomerPortalService,
    private readonly loyaltyPricing: LoyaltyPricingService,
    private readonly jwt: JwtService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // ── PUBLIC ─────────────────────────────────────────────────────────────────

  /** Returns Stripe publishable key for the tenant (safe to expose) */
  @Get('stripe-config')
  async stripeConfig(@Query('tenant_id') tenantId: string) {
    const pk = await this.svc.getStripePublishableKey(tenantId);
    return { publishableKey: pk };
  }

  /** Returns Stripe publishable key by tenant slug (safe to expose, no auth required) */
  @Get('stripe-config-by-slug')
  async stripeConfigBySlug(@Query('slug') slug: string) {
    const pk = await this.svc.getStripePublishableKeyBySlug(slug);
    return { publishableKey: pk };
  }

  @Get('tenant-info')
  getTenantInfo(@Query('slug') slug: string) {
    return this.svc.getTenantInfo(slug);
  }

  @Get('payments/token/:token')
  getPaymentToken(@Param('token') token: string) {
    return this.svc.getPaymentToken(token);
  }

  @Post('payments/token/:token/pay')
  payViaToken(@Param('token') token: string, @Body() body: any) {
    return this.svc.payViaToken(token, body);
  }

  /** Called by frontend after 3DS completes via handleNextAction */
  @Post('payments/token/:token/confirm-3ds')
  confirm3ds(@Param('token') token: string, @Body() body: any) {
    return this.svc.confirm3ds(token, body);
  }

  @Post('guest/checkout')
  guestCheckout(@Body() body: any) {
    return this.svc.guestCheckout(body.tenantSlug, body);
  }

  // ── PROTECTED ──────────────────────────────────────────────────────────────

  /**
   * Returns active (unexpired, non-converted) quote sessions for this customer.
   * Used by the portal to show resumable quotes above the quote form.
   */
  @Get('pending-quotes')
  @UseGuards(CustomerAuthGuard)
  listPendingQuotes(@Req() req: any) {
    return this.svc.listPendingQuotes(req.customer.sub, req.customer.tenant_id);
  }

  @Get('dashboard')
  @UseGuards(CustomerAuthGuard)
  getDashboard(@Req() req: any) {
    return this.svc.getDashboard(req.customer.sub, req.customer.tenant_id);
  }

  /**
   * Download final invoice PDF for a booking.
   * Enforces: booking belongs to authenticated customer + same tenant.
   * Returns 404 if no SENT/PAID invoice exists for the booking.
   */
  @Get('bookings/:id/invoice-pdf')
  @UseGuards(CustomerAuthGuard)
  async downloadInvoicePdf(
    @Param('id') bookingId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const result = await this.svc.getInvoicePdf(
      req.customer.sub,
      req.customer.tenant_id,
      bookingId,
    );
    if (!result) {
      throw new NotFoundException('Invoice not available for this booking');
    }
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length':      result.buffer.length,
      'Cache-Control':       'no-store',
    });
    res.end(result.buffer);
  }

  @Get('bookings')
  @UseGuards(CustomerAuthGuard)
  listBookings(@Req() req: any, @Query() query: any) {
    return this.svc.listBookings(req.customer.sub, req.customer.tenant_id, query);
  }

  // NOTE: must be registered BEFORE bookings/:id to avoid route shadowing
  @Get('bookings/resume')
  @UseGuards(CustomerAuthGuard)
  resumeBooking(@Req() req: any) {
    return this.svc.resumeBooking(req.customer.sub, req.customer.tenant_id);
  }

  @Get('bookings/:id')
  @UseGuards(CustomerAuthGuard)
  getBooking(@Req() req: any, @Param('id') id: string) {
    return this.svc.getBooking(req.customer.sub, req.customer.tenant_id, id);
  }

  @Post('bookings')
  @UseGuards(CustomerAuthGuard)
  createBooking(@Req() req: any, @Body() body: any) {
    return this.svc.createBooking(req.customer.sub, req.customer.tenant_id, body);
  }

  @Post('bookings/:id/cancel')
  @UseGuards(CustomerAuthGuard)
  cancelBooking(@Req() req: any, @Param('id') id: string) {
    return this.svc.cancelBooking(req.customer.sub, req.customer.tenant_id, id);
  }

  @Get('profile')
  @UseGuards(CustomerAuthGuard)
  getProfile(@Req() req: any) {
    return this.svc.getProfile(req.customer.sub, req.customer.tenant_id);
  }

  @Put('profile')
  @UseGuards(CustomerAuthGuard)
  updateProfile(@Req() req: any, @Body() body: any) {
    return this.svc.updateProfile(req.customer.sub, req.customer.tenant_id, body);
  }

  /**
   * GET /customer-portal/discount-preview
   *
   * Computes the loyalty-adjusted fare for the authenticated customer against a stored quote.
   * Uses LoyaltyPricingService — same logic that createBooking will apply at booking time.
   * Guaranteed: preview amount == booking amount == charge amount.
   */
  @Get('discount-preview')
  @UseGuards(CustomerAuthGuard)
  async discountPreview(
    @Req() req: any,
    @Query('quote_id') quoteId: string,
    @Query('car_type_id') carTypeId: string,
  ) {
    if (!quoteId) throw new BadRequestException('quote_id is required');

    // Load quote session — enforce expiry at DB level
    const [session] = await this.db.query(
      `SELECT id, tenant_id, payload, expires_at
       FROM public.quote_sessions
       WHERE id = $1 AND expires_at > now()
       LIMIT 1`,
      [quoteId],
    );
    if (!session) throw new NotFoundException('Quote expired or not found');

    // Validate tenant: quote must belong to the customer's tenant (from JWT)
    if (session.tenant_id !== req.customer.tenant_id) {
      throw new BadRequestException('Quote does not belong to this tenant');
    }

    const payload = session.payload;
    const result  = (payload.results ?? []).find((r: any) => r.service_class_id === carTypeId)
      ?? payload.results?.[0];
    if (!result) throw new NotFoundException('Car type not found in quote');

    const pricing = await this.loyaltyPricing.compute(
      req.customer.sub,
      req.customer.tenant_id,
      result,
      payload.currency ?? 'AUD',
    );

    return {
      base_fare_minor:  pricing.trueBase + pricing.tollParkingMinor,
      discount_minor:   pricing.discountMinor,
      final_fare_minor: pricing.finalFareMinor,
      discount_name:    pricing.discountName,
      discount_rate:    pricing.discountRate,
      capped_by_max:    pricing.cappedByMax,
      currency:         pricing.currency,
    };
  }

  @Get('passengers')
  @UseGuards(CustomerAuthGuard)
  listPassengers(@Req() req: any) {
    return this.svc.listPassengers(req.customer.sub);
  }

  @Post('passengers')
  @UseGuards(CustomerAuthGuard)
  addPassenger(@Req() req: any, @Body() body: any) {
    return this.svc.addPassenger(req.customer.sub, req.customer.tenant_id, body);
  }

  @Get('payment-methods')
  @UseGuards(CustomerAuthGuard)
  listPaymentMethods(@Req() req: any) {
    return this.svc.listPaymentMethods(req.customer.sub, req.customer.tenant_id);
  }

  /** Public endpoint — for guest checkout (no auth required) */
  @Post('payments/guest-setup-intent')
  createGuestSetupIntent(@Body() body: { slug: string }) {
    return this.svc.createGuestSetupIntent(body.slug);
  }

  @Post('payments/setup-intent')
  @UseGuards(CustomerAuthGuard)
  createSetupIntent(@Req() req: any) {
    return this.svc.createSetupIntent(req.customer.sub, req.customer.tenant_id);
  }

  @Post('payments/setup-confirm')
  @UseGuards(CustomerAuthGuard)
  confirmSetup(@Req() req: any, @Body() body: any) {
    return this.svc.confirmSetup(req.customer.sub, req.customer.tenant_id, body);
  }

  @Delete('payment-methods/:id')
  @UseGuards(CustomerAuthGuard)
  deletePaymentMethod(@Req() req: any, @Param('id') id: string) {
    return this.svc.deletePaymentMethod(req.customer.sub, req.customer.tenant_id, id);
  }

  @Get('invoices')
  @UseGuards(CustomerAuthGuard)
  listInvoices(@Req() req: any) {
    return this.svc.listInvoices(req.customer.sub, req.customer.tenant_id);
  }

  @Post('bookings/:id/confirm')
  @UseGuards(CustomerAuthGuard)
  confirmBooking(@Req() req: any, @Param('id') id: string) {
    return this.svc.confirmBooking(req.customer.sub, req.customer.tenant_id, id);
  }

  /** Save Expo push token for customer push notifications */
  @Post('push-token')
  @UseGuards(CustomerAuthGuard)
  savePushToken(@Req() req: any, @Body() body: { token: string; platform?: string }) {
    return this.svc.savePushToken(req.customer.sub, req.customer.tenant_id, body.token);
  }

  /** Get email verification status */
  @Get('verification-status')
  @UseGuards(CustomerAuthGuard)
  getVerificationStatus(@Req() req: any) {
    return this.svc.getVerificationStatus(req.customer.sub, req.customer.tenant_id);
  }

  /** Send OTP to customer email */
  @Post('send-email-otp')
  @UseGuards(CustomerAuthGuard)
  sendEmailOtp(@Req() req: any) {
    return this.svc.sendEmailOtp(req.customer.sub, req.customer.tenant_id);
  }

  /** Verify OTP */
  @Post('verify-email-otp')
  @UseGuards(CustomerAuthGuard)
  verifyEmailOtp(@Req() req: any, @Body() body: { otp: string }) {
    return this.svc.verifyEmailOtp(req.customer.sub, req.customer.tenant_id, body.otp);
  }
}
