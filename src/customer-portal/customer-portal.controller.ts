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

@Controller('customer-portal')
export class CustomerPortalController {
  constructor(
    private readonly svc: CustomerPortalService,
    private readonly jwt: JwtService,
  ) {}

  // ── PUBLIC ─────────────────────────────────────────────────────────────────
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
