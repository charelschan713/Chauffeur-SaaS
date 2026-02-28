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
import { DataSource } from 'typeorm';
import { PAYMENT_EVENTS } from './payment-events';

@Controller('webhooks')
export class StripeWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-04-10',
    });
  }

  @Post('stripe')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(body));
    const signature = req.headers['stripe-signature'];
    if (!signature) throw new BadRequestException('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      throw new BadRequestException(`Invalid signature: ${err.message}`);
    }

    const dataObject: any = event.data.object;
    const tenantId = dataObject?.metadata?.tenant_id;
    if (!tenantId) throw new BadRequestException('Missing tenant metadata');

    await this.dataSource.query(`select set_config('app.tenant_id', $1, true)`, [tenantId]);

    const inserted = await this.dataSource.query(
      `insert into public.stripe_events (
        tenant_id, stripe_event_id, event_type, payload_snapshot
      ) values ($1,$2,$3,$4)
      on conflict (tenant_id, stripe_event_id) do nothing
      returning id`,
      [tenantId, event.id, event.type, event],
    );

    if (!inserted.length) {
      return res.sendStatus(200);
    }

    await this.handleEvent(event, tenantId);
    return res.sendStatus(200);
  }

  private async handleEvent(event: Stripe.Event, tenantId: string) {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        await this.handleAuthorized(event, tenantId);
        break;
      case 'charge.captured':
        await this.handleCaptured(event, tenantId);
        break;
      case 'charge.refunded':
        await this.handleRefunded(event, tenantId);
        break;
      case 'payment_intent.payment_failed':
        await this.handleFailed(event, tenantId);
        break;
      default:
        break;
    }
  }

  private async handleAuthorized(event: Stripe.Event, tenantId: string) {
    const intent = event.data.object as Stripe.PaymentIntent;
    await this.dataSource.query(
      `update public.payments
       set payment_status = 'AUTHORIZED',
           amount_authorized_minor = $1
       where stripe_payment_intent_id = $2`,
      [intent.amount_capturable ?? intent.amount ?? 0, intent.id],
    );

    await this.paymentService.recordOutboxEvent(tenantId, intent.id, PAYMENT_EVENTS.PAYMENT_AUTHORIZED, {
      tenant_id: tenantId,
      payment_intent_id: intent.id,
      amount_authorized_minor: intent.amount_capturable ?? intent.amount ?? 0,
      currency: intent.currency,
    });
  }

  private async handleCaptured(event: Stripe.Event, tenantId: string) {
    const charge = event.data.object as Stripe.Charge;
    await this.dataSource.query(
      `update public.payments
       set payment_status = 'PAID',
           amount_captured_minor = $1
       where stripe_payment_intent_id = $2`,
      [charge.amount_captured ?? charge.amount, charge.payment_intent],
    );

    await this.paymentService.recordOutboxEvent(tenantId, charge.payment_intent as string, PAYMENT_EVENTS.PAYMENT_CAPTURED, {
      tenant_id: tenantId,
      payment_intent_id: charge.payment_intent,
      amount_captured_minor: charge.amount_captured ?? charge.amount,
      currency: charge.currency,
    });
  }

  private async handleRefunded(event: Stripe.Event, tenantId: string) {
    const charge = event.data.object as Stripe.Charge;
    const refunded = charge.amount_refunded ?? 0;
    const status = refunded >= (charge.amount_captured ?? charge.amount)
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';

    await this.dataSource.query(
      `update public.payments
       set amount_refunded_minor = $1,
           payment_status = $2
       where stripe_payment_intent_id = $3`,
      [refunded, status, charge.payment_intent],
    );

    await this.paymentService.recordOutboxEvent(tenantId, charge.payment_intent as string, PAYMENT_EVENTS.PAYMENT_REFUNDED, {
      tenant_id: tenantId,
      payment_intent_id: charge.payment_intent,
      amount_refunded_minor: refunded,
      status,
    });
  }

  private async handleFailed(event: Stripe.Event, tenantId: string) {
    const intent = event.data.object as Stripe.PaymentIntent;
    await this.dataSource.query(
      `update public.payments
       set payment_status = 'FAILED'
       where stripe_payment_intent_id = $1`,
      [intent.id],
    );

    await this.paymentService.recordOutboxEvent(tenantId, intent.id, PAYMENT_EVENTS.PAYMENT_FAILED, {
      tenant_id: tenantId,
      payment_intent_id: intent.id,
    });
  }
}
