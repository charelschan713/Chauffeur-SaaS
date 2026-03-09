import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import Stripe from 'stripe';
import { Request, Response } from 'express';
import { DataSource, EntityManager } from 'typeorm';
import { PAYMENT_EVENTS } from './payment-events';

@Controller('webhooks')
export class StripeWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  @Post('stripe')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    // NestFactory.create({ rawBody: true }) injects req.rawBody as raw bytes.
    // Fallback: if rawBody is missing but req.body is already a Buffer (express.raw legacy),
    // use that. Never re-serialize parsed JSON — signature will not match.
    const rawBody: Buffer = (req as any).rawBody
      ?? (Buffer.isBuffer(req.body) ? req.body : undefined);
    if (!rawBody) throw new BadRequestException('Raw body unavailable — check NestJS rawBody config');
    const signature = req.headers['stripe-signature'];
    if (!signature) throw new BadRequestException('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Invalid signature: ${message}`);
    }

    const dataObject: any = event.data.object;
    const tenantId = dataObject?.metadata?.tenant_id;
    if (!tenantId) throw new BadRequestException('Missing tenant metadata');

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.query(`select set_config('app.tenant_id', $1, true)`, [tenantId]);

      const inserted = await manager.query(
        `insert into public.stripe_events (
          tenant_id, stripe_event_id, event_type, payload_snapshot
        ) values ($1,$2,$3,$4)
        on conflict (tenant_id, stripe_event_id) do nothing
        returning id`,
        [tenantId, event.id, event.type, event],
      );

      if (!inserted.length) {
        return;
      }

      await this.handleEvent(event, tenantId, manager);
    });

    return res.sendStatus(200);
  }

  private async handleEvent(
    event: Stripe.Event,
    tenantId: string,
    manager: EntityManager,
  ) {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        // manual-capture flow: PI is now capturable (AUTHORIZED)
        await this.handleAuthorized(event, tenantId, manager);
        break;
      case 'payment_intent.succeeded':
        // direct-confirm flow: PI succeeded without manual capture (e.g. payViaToken)
        await this.handleIntentSucceeded(event, tenantId, manager);
        break;
      case 'charge.captured':
        await this.handleCaptured(event, tenantId, manager);
        break;
      case 'charge.refunded':
        await this.handleRefunded(event, tenantId, manager);
        break;
      case 'payment_intent.payment_failed':
        await this.handleFailed(event, tenantId, manager);
        break;
      default:
        break;
    }
  }

  private async handleAuthorized(
    event: Stripe.Event,
    tenantId: string,
    manager: EntityManager,
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;
    // P0-3: amount_capturable_updated fires when PI is capturable (manual-capture hold confirmed)
    // This is the correct AUTHORIZED state: card hold placed, awaiting capture
    const amountAuth = intent.amount_capturable ?? intent.amount ?? 0;
    await manager.query(
      `update public.payments
       set payment_status = 'AUTHORIZED',
           amount_authorized_minor = $1,
           updated_at = now()
       where stripe_payment_intent_id = $2
         and tenant_id = $3
         and payment_status NOT IN ('PAID', 'CAPTURE_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED')`,
      [amountAuth, intent.id, tenantId],
    );

    await this.paymentService.recordOutboxEvent(
      manager, tenantId, intent.id,
      PAYMENT_EVENTS.PAYMENT_AUTHORIZED,
      { tenant_id: tenantId, payment_intent_id: intent.id, amount_authorized_minor: amountAuth, currency: intent.currency },
      event.id,
    );
  }

  // P0-3: direct-confirm flow — payment_intent.succeeded fires when PI succeeds without manual capture
  private async handleIntentSucceeded(
    event: Stripe.Event,
    tenantId: string,
    manager: EntityManager,
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata?.booking_id;
    const amountCaptured = intent.amount_received ?? intent.amount ?? 0;

    await manager.query(
      `update public.payments
       set payment_status = 'PAID',
           amount_captured_minor = $1,
           updated_at = now()
       where stripe_payment_intent_id = $2
         and tenant_id = $3
         and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED')`,
      [amountCaptured, intent.id, tenantId],
    );

    // Sync bookings.payment_status
    await manager.query(
      `update public.bookings
       set payment_status = 'PAID', updated_at = now()
       where stripe_payment_intent_id = $1
         and tenant_id = $2
         and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')`,
      [intent.id, tenantId],
    );

    // If booking_id in metadata, also mark confirmed via bookingId match
    if (bookingId) {
      await manager.query(
        `update public.bookings
         set operational_status = 'CONFIRMED', payment_status = 'PAID', updated_at = now()
         where id = $1
           and tenant_id = $2
           and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')`,
        [bookingId, tenantId],
      );
    }

    await this.paymentService.recordOutboxEvent(
      manager, tenantId, intent.id,
      PAYMENT_EVENTS.PAYMENT_CAPTURED,
      { tenant_id: tenantId, payment_intent_id: intent.id, amount_captured_minor: amountCaptured, currency: intent.currency },
      event.id,
    );
  }

  private async handleCaptured(
    event: Stripe.Event,
    tenantId: string,
    manager: EntityManager,
  ) {
    const charge = event.data.object as Stripe.Charge;
    const piId = charge.payment_intent as string;
    const amountCaptured = charge.amount_captured ?? charge.amount;

    // P0-4: update payments aggregate (source of truth)
    await manager.query(
      `update public.payments
       set payment_status = 'PAID',
           amount_captured_minor = $1
       where stripe_payment_intent_id = $2
         and tenant_id = $3
         and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')`,
      [amountCaptured, piId, tenantId],
    );

    // P0-C: sync bookings.payment_status from authoritative payment event
    await manager.query(
      `update public.bookings
       set payment_status = 'PAID', updated_at = now()
       where stripe_payment_intent_id = $1
         and tenant_id = $2
         and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')`,
      [piId, tenantId],
    );

    await this.paymentService.recordOutboxEvent(
      manager, tenantId, piId,
      PAYMENT_EVENTS.PAYMENT_CAPTURED,
      { tenant_id: tenantId, payment_intent_id: piId, amount_captured_minor: amountCaptured, currency: charge.currency },
      event.id,
    );
  }

  private async handleRefunded(
    event: Stripe.Event,
    tenantId: string,
    manager: EntityManager,
  ) {
    const charge = event.data.object as Stripe.Charge;
    const piId = charge.payment_intent as string;
    const refunded = charge.amount_refunded ?? 0;
    const status = refunded >= (charge.amount_captured ?? charge.amount)
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';

    // P0-4: update payments aggregate
    await manager.query(
      `update public.payments
       set amount_refunded_minor = $1, payment_status = $2
       where stripe_payment_intent_id = $3
         and tenant_id = $4
         and payment_status IN ('PAID', 'PARTIALLY_REFUNDED')`,
      [refunded, status, piId, tenantId],
    );

    // P0-C: sync bookings.payment_status
    await manager.query(
      `update public.bookings
       set payment_status = $1, updated_at = now()
       where stripe_payment_intent_id = $2
         and tenant_id = $3
         and payment_status IN ('PAID', 'PARTIALLY_REFUNDED')`,
      [status, piId, tenantId],
    );

    await this.paymentService.recordOutboxEvent(
      manager, tenantId, piId,
      PAYMENT_EVENTS.PAYMENT_REFUNDED,
      { tenant_id: tenantId, payment_intent_id: piId, amount_refunded_minor: refunded, status },
      event.id,
    );
  }

  private async handleFailed(
    event: Stripe.Event,
    tenantId: string,
    manager: EntityManager,
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;

    // P0-4: update payments aggregate
    await manager.query(
      `update public.payments
       set payment_status = 'FAILED'
       where stripe_payment_intent_id = $1
         and tenant_id = $2
         and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED')`,
      [intent.id, tenantId],
    );

    // P0-C: sync bookings — mark payment failed, operational_status unchanged
    // (admin retries payment; operational state is decoupled from payment state)
    await manager.query(
      `update public.bookings
       set payment_status = 'FAILED', updated_at = now()
       where stripe_payment_intent_id = $1
         and tenant_id = $2
         and payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED')`,
      [intent.id, tenantId],
    );

    await this.paymentService.recordOutboxEvent(
      manager, tenantId, intent.id,
      PAYMENT_EVENTS.PAYMENT_FAILED,
      { tenant_id: tenantId, payment_intent_id: intent.id },
      event.id,
    );
  }
}
