import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  controllers: [StripeWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
