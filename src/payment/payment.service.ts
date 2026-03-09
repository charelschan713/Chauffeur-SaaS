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
  stripeCustomerId?: string | null;
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
    // Resolve stripe_customer_id for this booking's customer (enables saved cards)
    let stripeCustomerId = dto.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const customerRows = await this.dataSource.query(
        `SELECT pm.stripe_customer_id
         FROM public.bookings b
         JOIN public.payment_methods pm ON pm.customer_id = b.customer_id
           AND pm.tenant_id = b.tenant_id AND pm.is_active = true
         WHERE b.id = $1 AND b.tenant_id = $2
         LIMIT 1`,
        [bookingId, tenantId],
      );
      stripeCustomerId = customerRows[0]?.stripe_customer_id ?? null;
    }

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: dto.amountMinor,
        currency: dto.currency,
        capture_method: 'manual',
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        metadata: {
          tenant_id: tenantId,
          booking_id: bookingId,
          payment_type: 'INITIAL',
        },
      },
      { stripeAccount: dto.stripeAccountId },
    );

    // P1-A: store actual requested amount; status reflects real lifecycle state
    // capture_method='manual' means PI is authorized-but-not-captured after confirmation
    // At creation (pre-confirmation) it is UNPAID; amount is known and must be persisted
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
      ) values ($1,$2,$3,$4,'INITIAL',$5,$6,0,0,'UNPAID')
      on conflict (tenant_id, stripe_payment_intent_id) do nothing`,
      [tenantId, bookingId, dto.stripeAccountId, paymentIntent.id, dto.currency, dto.amountMinor],
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
    };
  }

  async capturePayment(bookingId: string, paymentIntentId?: string) {
    // P1-B: target deterministically — prefer explicit PI id; else require AUTHORIZED status
    // (avoids capturing a wrong/stale payment row when multiple exist for the same booking)
    const rows = await this.dataSource.query(
      `select stripe_payment_intent_id, stripe_account_id, payment_status
       from public.payments
       where booking_id = $1
         and ($2::text IS NULL OR stripe_payment_intent_id = $2)
         and payment_status = 'AUTHORIZED'
       order by created_at desc
       limit 1`,
      [bookingId, paymentIntentId ?? null],
    );

    if (!rows.length) throw new NotFoundException('No authorized payment found for this booking');
    const payment = rows[0];

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
