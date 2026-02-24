import {
  Controller,
  Post,
  Req,
  Headers,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../config/supabase.config';

@Controller('public/stripe-webhook')
export class StripeWebhookController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2023-10-16' as any,
  });

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody as Buffer,
        sig,
        webhookSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(`Webhook error: ${err.message}`);
    }

    switch (event.type) {
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const booking_id = setupIntent.metadata?.booking_id;
        if (booking_id) {
          await this.chargeAfterSetup(setupIntent, booking_id);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const booking_id = paymentIntent.metadata?.booking_id;
        if (booking_id) {
          await supabaseAdmin
            .from('bookings')
            .update({
              payment_status: 'PAID',
              booking_status: 'CONFIRMED',
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', booking_id);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const booking_id = paymentIntent.metadata?.booking_id;
        if (booking_id) {
          await supabaseAdmin
            .from('bookings')
            .update({ payment_status: 'FAILED' })
            .eq('id', booking_id);
        }
        break;
      }
    }

    return { received: true };
  }

  private async chargeAfterSetup(
    setupIntent: Stripe.SetupIntent,
    booking_id: string,
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('total_fare, tenant_id')
      .eq('id', booking_id)
      .single();

    if (!booking) return;

    const amountCents = Math.round(Number(booking.total_fare || 0) * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'aud',
      customer: setupIntent.customer as string,
      payment_method: setupIntent.payment_method as string,
      confirm: true,
      metadata: {
        booking_id,
        tenant_id: booking.tenant_id,
      },
    });

    if (paymentIntent.status === 'succeeded') {
      await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'PAID',
          booking_status: 'CONFIRMED',
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: setupIntent.customer as string,
        })
        .eq('id', booking_id);
    }
  }
}
