import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { RefundDto } from './dto/refund.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Stripe Webhook（不需要JWT，Stripe直接调用）
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody!, signature);
  }

  // 以下需要JWT
  @Post('intent')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('PASSENGER', 'CORPORATE_ADMIN')
  createIntent(@Body() dto: CreatePaymentIntentDto, @Request() req: any) {
    return this.paymentsService.createPaymentIntent(req.user.id, dto);
  }

  @Get('booking/:booking_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('PASSENGER', 'CORPORATE_ADMIN')
  getPayment(@Param('booking_id') booking_id: string, @Request() req: any) {
    return this.paymentsService.getPaymentByBooking(booking_id, req.user.id);
  }

  @Post('refund')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('PASSENGER', 'TENANT_ADMIN')
  refund(@Body() dto: RefundDto, @Request() req: any) {
    return this.paymentsService.refund(dto.booking_id, req.user.id);
  }

  @Get('revenue')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  getRevenue(@Request() req: any) {
    return this.paymentsService.getTenantRevenue(req.user.profile.tenant_id);
  }
}
