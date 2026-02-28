import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import Stripe from 'stripe';
import { PAYMENT_EVENTS } from './payment-events';
import { OnEvent } from '@nestjs/event-emitter';
import { BOOKING_EVENTS } from '../booking/booking-events';

interface CreatePaymentIntentDto {
  amountMinor: number;
  currency: string;
  stripeAccountId: string;
}

@Injectable()
export class PaymentService {
  private readonly stripe: Stripe;

  constructor(private readonly dataSource: DataSource) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  async createPaymentIntent(
    tenantId: string,
    bookingId: string,
    dto: CreatePaymentIntentDto,
  ) {
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: dto.amountMinor,
        currency: dto.currency,
        capture_method: 'manual',
        metadata: {
          tenant_id: tenantId,
          booking_id: bookingId,
          payment_type: 'INITIAL',
        },
      },
      { stripeAccount: dto.stripeAccountId },
    );

    await this.dataSource.query(
      `insert into public.payments (
        tenant_id,
        booking_id,
        stripe_account_id,
        stripe_payment_intent_id,
        payment_type,
        currency,
        amount_authorized_minor,
        amount_captured_minor,
        amount_refunded_minor,
        payment_status
      ) values ($1,$2,$3,$4,'INITIAL',$5,0,0,0,'UNPAID')
      on conflict (tenant_id, stripe_payment_intent_id) do nothing`,
      [tenantId, bookingId, dto.stripeAccountId, paymentIntent.id, dto.currency],
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
    };
  }

  async capturePayment(bookingId: string) {
    const rows = await this.dataSource.query(
      `select stripe_payment_intent_id, stripe_account_id, payment_status
       from public.payments
       where booking_id = $1
       order by created_at desc
       limit 1`,
      [bookingId],
    );

    if (!rows.length) throw new NotFoundException('Payment not found');
    const payment = rows[0];
    if (payment.payment_status !== 'AUTHORIZED') {
      throw new BadRequestException('Payment not authorized');
    }

    await this.stripe.paymentIntents.capture(
      payment.stripe_payment_intent_id,
      {},
      { stripeAccount: payment.stripe_account_id },
    );

    await this.dataSource.query(
      `update public.payments
       set payment_status = 'CAPTURE_PENDING'
       where stripe_payment_intent_id = $1`,
      [payment.stripe_payment_intent_id],
    );

    return { success: true };
  }

  async createRefund(paymentId: string, amountMinor?: number) {
    const rows = await this.dataSource.query(
      `select tenant_id, stripe_payment_intent_id, stripe_account_id
       from public.payments
       where stripe_payment_intent_id = $1`,
      [paymentId],
    );

    if (!rows.length) throw new NotFoundException('Payment not found');
    const payment = rows[0];

    await this.stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: amountMinor,
      },
      { stripeAccount: payment.stripe_account_id },
    );

    return { success: true };
  }

  async recordOutboxEvent(
    manager: EntityManager,
    tenantId: string,
    paymentIntentId: string,
    eventType: string,
    payload: any,
  ) {
    await manager.query(
      `insert into public.outbox_events (
        tenant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        event_schema_version,
        payload
      ) values ($1,'payment',$2,$3,1,$4)`,
      [tenantId, paymentIntentId, eventType, payload],
    );
  }

  @OnEvent(BOOKING_EVENTS.JOB_COMPLETED)
  async onJobCompleted(payload: { booking_id: string } | undefined) {
    if (!payload?.booking_id) return;
    try {
      await this.capturePayment(payload.booking_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Capture failed:', message);
    }
  }
}
