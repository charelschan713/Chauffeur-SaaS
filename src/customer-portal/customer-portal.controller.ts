import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { DiscountService } from '../discount/discount.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('customer-portal')
export class CustomerPortalController {
  constructor(
    private readonly svc: CustomerPortalService,
    private readonly jwt: JwtService,
    private readonly discountSvc: DiscountService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // ── PUBLIC ─────────────────────────────────────────────────────────────────

  /** Returns Stripe publishable key for the tenant (safe to expose) */
  @Get('stripe-config')
  async stripeConfig(@Query('tenant_id') tenantId: string) {
    const pk = await this.svc.getStripePublishableKey(tenantId);
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

  @Post('guest/checkout')
  guestCheckout(@Body() body: any) {
    return this.svc.guestCheckout(body.tenantSlug, body);
  }

  // ── PROTECTED ──────────────────────────────────────────────────────────────
  @Get('dashboard')
  @UseGuards(CustomerAuthGuard)
  getDashboard(@Req() req: any) {
    return this.svc.getDashboard(req.customer.sub, req.customer.tenant_id);
  }

  @Get('bookings')
  @UseGuards(CustomerAuthGuard)
  listBookings(@Req() req: any, @Query() query: any) {
    return this.svc.listBookings(req.customer.sub, req.customer.tenant_id, query);
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
    return this.svc.getProfile(req.customer.sub);
  }

  @Put('profile')
  @UseGuards(CustomerAuthGuard)
  updateProfile(@Req() req: any, @Body() body: any) {
    return this.svc.updateProfile(req.customer.sub, body);
  }

  /**
   * After login on /book page: re-calculate discount with customer's personal rate stacked on top
   * of any base discount. Returns adjusted price breakdown.
   *
   * Only the displayed price changes on the frontend — the actual charge happens at booking submit.
   */
  @Get('discount-preview')
  @UseGuards(CustomerAuthGuard)
  async discountPreview(
    @Req() req: any,
    @Query('quote_id') quoteId: string,
    @Query('car_type_id') carTypeId: string,
  ) {
    // Load quote session
    const now = new Date();
    const [session] = await this.db.query(
      `SELECT * FROM public.quote_sessions WHERE id = $1 AND expires_at > $2 LIMIT 1`,
      [quoteId, now],
    );
    if (!session) return { error: 'Quote expired or not found' };

    const payload = session.payload;
    const result = (payload.results ?? []).find((r: any) => r.service_class_id === carTypeId)
      ?? payload.results?.[0];
    if (!result) return { error: 'Car type not found in quote' };

    // Pre-discount fare (base fare before any discount)
    const baseFare = result.pricing_snapshot_preview?.pre_discount_total_minor
      ?? result.estimated_total_minor;

    // Re-resolve discount with customer ID (stacks customer loyalty rate)
    const discount = await this.discountSvc.resolveDiscount(
      session.tenant_id,
      baseFare,
      {
        serviceTypeId: payload.request?.service_type_id,
        customerId:    req.customer.sub,
        isNewCustomer: false,
      },
    );

    return {
      base_fare_minor:          baseFare,
      discount_minor:           discount?.discountMinor ?? 0,
      final_fare_minor:         discount?.finalFareMinor ?? baseFare,
      discount_name:            discount?.name ?? null,
      discount_rate:            discount?.value ?? 0,
      capped_by_max:            discount?.cappedByMax ?? false,
      currency:                 payload.currency ?? 'AUD',
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
}
