import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // =====================
  // 乘客路由
  // =====================

  @Post('intent/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('PASSENGER')
  createIntent(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.paymentsService.createPaymentIntent(
      req.user.id,
      booking_id,
      req.user.profile.tenant_id,
    );
  }

  @Post('payment-method')
  @UseGuards(JwtGuard)
  savePaymentMethod(
    @Body('payment_method_id') payment_method_id: string,
    @Request() req: any,
  ) {
    return this.paymentsService.savePaymentMethod(req.user.id, payment_method_id);
  }

  @Get('payment-method')
  @UseGuards(JwtGuard)
  getSavedPaymentMethod(@Request() req: any) {
    return this.paymentsService.getSavedPaymentMethod(req.user.id);
  }

  @Get('stripe-key')
  @UseGuards(JwtGuard)
  getStripePublishableKey(@Request() req: any) {
    return this.paymentsService
      .getPublishableKey(req.user.profile.tenant_id)
      .then((publishable_key) => ({ publishable_key }));
  }

  // =====================
  // Admin路由
  // =====================

  @Post('charge/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  chargeBooking(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.paymentsService.chargeBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
    );
  }

  @Post('supplement/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  addSupplement(
    @Param('id') booking_id: string,
    @Body() dto: { amount: number; reason?: string },
    @Request() req: any,
  ) {
    return this.paymentsService.addSupplement(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('supplement/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  supplement(
    @Param('booking_id') booking_id: string,
    @Body() dto: { supplement_amount: number; note?: string },
    @Request() req: any,
  ) {
    return this.paymentsService.chargeSupplementAmount(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('credit-note/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  addCreditNote(
    @Param('id') booking_id: string,
    @Body() dto: { amount: number; reason?: string },
    @Request() req: any,
  ) {
    return this.paymentsService.addCreditNote(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('credit-note/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  creditNote(
    @Param('booking_id') booking_id: string,
    @Body() dto: { credit_amount: number; note?: string },
    @Request() req: any,
  ) {
    return this.paymentsService.issueCreditNote(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('refund/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  refund(
    @Param('booking_id') booking_id: string,
    @Body('note') note: string,
    @Request() req: any,
  ) {
    return this.paymentsService.issueFullRefund(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      note,
    );
  }

  @Get('history/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getPaymentHistory(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.paymentsService.getPaymentHistory(
      booking_id,
      req.user.profile.tenant_id,
    );
  }

  // =====================
  // 确认Token（公开路由）
  // =====================

  @Get('confirm/:token')
  validateConfirmToken(@Param('token') token: string) {
    return this.paymentsService.validateConfirmToken(token);
  }

  @Post('confirm/:token')
  useConfirmToken(
    @Param('token') token: string,
    @Body('payment_method_id') payment_method_id?: string,
  ) {
    return this.paymentsService.useConfirmToken(token, payment_method_id);
  }

  // =====================
  // Stripe Webhook
  // =====================
  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody!, signature);
  }
}
