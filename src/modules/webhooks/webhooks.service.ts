import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import * as crypto from 'crypto';
import Stripe from 'stripe';
import { NotificationsService } from '../notifications/notifications.service';

export const WEBHOOK_EVENTS = [
  'booking.created',
  'booking.confirmed',
  'booking.cancelled',
  'booking.completed',
  'booking.driver_assigned',
  'booking.driver_on_the_way',
  'booking.driver_arrived',
  'booking.no_show',
  'payment.paid',
  'payment.refunded',
  'driver.verified',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

@Injectable()
export class WebhooksService {
  constructor(private readonly notificationsService: NotificationsService) {}

  private getStripeClient(secretKey: string): Stripe {
    return new Stripe(secretKey, { apiVersion: '2026-01-28.clover' });
  }

  private generateSecret(): string {
    return 'whsec_' + crypto.randomBytes(24).toString('hex');
  }

  private signPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async createWebhook(
    tenant_id: string,
    dto: {
      webhook_name: string;
      webhook_url: string;
      events: string[];
    },
  ) {
    const invalid = dto.events.filter(
      (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid events: ${invalid.join(', ')}`);
    }

    const secret = this.generateSecret();

    const { data, error } = await supabaseAdmin
      .from('tenant_webhooks')
      .insert({
        tenant_id,
        webhook_name: dto.webhook_name,
        webhook_url: dto.webhook_url,
        secret_key: secret,
        events: dto.events,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      ...data,
      secret_key: secret,
      message: 'Save this secret key. Use it to verify webhook signatures.',
    };
  }

  async listWebhooks(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_webhooks')
      .select(
        'id, webhook_name, webhook_url, is_active, events, last_triggered_at, last_status_code, failure_count, created_at',
      )
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async updateWebhook(
    webhook_id: string,
    tenant_id: string,
    dto: {
      webhook_name?: string;
      webhook_url?: string;
      events?: string[];
      is_active?: boolean;
    },
  ) {
    const { data, error } = await supabaseAdmin
      .from('tenant_webhooks')
      .update(dto)
      .eq('id', webhook_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Webhook not found');
    return data;
  }

  async deleteWebhook(webhook_id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_webhooks')
      .delete()
      .eq('id', webhook_id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Webhook not found');
    return { message: 'Webhook deleted', id: webhook_id };
  }

  async getDeliveryLogs(webhook_id: string, tenant_id: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhook_id)
      .eq('tenant_id', tenant_id)
      .order('delivered_at', { ascending: false })
      .limit(limit);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async testWebhook(webhook_id: string, tenant_id: string) {
    const { data: webhook } = await supabaseAdmin
      .from('tenant_webhooks')
      .select('*')
      .eq('id', webhook_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!webhook) throw new NotFoundException('Webhook not found');

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhook_id,
      },
    };

    const result = await this.deliverWebhook(webhook, 'webhook.test', testPayload);

    return {
      success: result.success,
      status_code: result.status_code,
      duration_ms: result.duration_ms,
      message: result.success
        ? 'Test webhook delivered successfully'
        : 'Test webhook failed',
    };
  }

  async deliverWebhook(
    webhook: any,
    event_type: string,
    payload: any,
  ): Promise<{ success: boolean; status_code: number; duration_ms: number }> {
    const payloadStr = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = this.signPayload(
      `${timestamp}.${payloadStr}`,
      webhook.secret_key,
    );

    const startTime = Date.now();
    let status_code = 0;
    let response_body = '';
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event_type,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-ID': webhook.id,
          'User-Agent': 'ChauffeurPlatform-Webhook/1.0',
        },
        body: payloadStr,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      status_code = res.status;
      response_body = await res.text().catch(() => '');
      success = res.status >= 200 && res.status < 300;
    } catch (err: any) {
      status_code = 0;
      response_body = err.message ?? 'Request failed';
      success = false;
    }

    const duration_ms = Date.now() - startTime;

    // Log delivery
    await supabaseAdmin
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        tenant_id: webhook.tenant_id,
        event_type,
        payload,
        response_status: status_code,
        response_body: response_body.slice(0, 1000),
        duration_ms,
        success,
      })
      .then(() => {});

    // Update webhook status
    const updateData: any = {
      last_triggered_at: new Date().toISOString(),
      last_status_code: status_code,
    };
    if (success) {
      updateData.failure_count = 0;
    }

    await supabaseAdmin
      .from('tenant_webhooks')
      .update(updateData)
      .eq('id', webhook.id)
      .then(() => {});

    if (!success) {
      // Increment failure count separately
      try {
        await supabaseAdmin.rpc('increment_webhook_failure', {
          p_webhook_id: webhook.id,
        });
      } catch {
        // Fallback: manual increment
        await supabaseAdmin
          .from('tenant_webhooks')
          .update({ failure_count: (webhook.failure_count ?? 0) + 1 })
          .eq('id', webhook.id)
          .then(() => {});
      }
    }

    return { success, status_code, duration_ms };
  }

  async handlePlatformWebhook(payload: Buffer, signature: string) {
    const platformSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    const stripeSecret = process.env.STRIPE_SECRET_KEY ?? '';
    if (!platformSecret || !stripeSecret) {
      throw new BadRequestException('Platform Stripe webhook not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.getStripeClient(stripeSecret).webhooks.constructEvent(
        payload,
        signature,
        platformSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(`Invalid platform Stripe signature: ${err.message}`);
    }

    switch (event.type) {
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from('tenants')
          .update({ subscription_status: String(sub.status).toUpperCase(), updated_at: new Date().toISOString() })
          .eq('subscription_plan_id', sub.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from('tenants')
          .update({ subscription_status: 'CANCELLED', updated_at: new Date().toISOString() })
          .eq('subscription_plan_id', sub.id);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice: any = event.data.object as any;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          await supabaseAdmin
            .from('tenants')
            .update({ subscription_status: 'PAST_DUE', updated_at: new Date().toISOString() })
            .eq('subscription_plan_id', subscriptionId);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice: any = event.data.object as any;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          await supabaseAdmin
            .from('tenants')
            .update({ subscription_status: 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('subscription_plan_id', subscriptionId);
        }
        break;
      }
      default:
        break;
    }

    return { received: true, mode: 'platform', event: event.type };
  }

  async handleTenantWebhook(tenant_slug: string, payload: Buffer, signature: string) {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, slug')
      .eq('slug', tenant_slug)
      .maybeSingle();

    if (tenantError || !tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const { data: settings } = await supabaseAdmin
      .from('tenant_settings')
      .select('stripe_secret_key, stripe_webhook_secret')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    const tenantStripeSecret = (settings as any)?.stripe_secret_key;
    const tenantWebhookSecret = (settings as any)?.stripe_webhook_secret;

    if (!tenantStripeSecret || !tenantWebhookSecret) {
      throw new BadRequestException('Tenant Stripe webhook is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.getStripeClient(tenantStripeSecret).webhooks.constructEvent(
        payload,
        signature,
        tenantWebhookSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(`Invalid tenant Stripe signature: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.updateBookingFromPayment(pi.id, 'PAID', 'CONFIRMED');
        if (pi.metadata?.booking_id) {
          await this.notificationsService.notifyBookingConfirmed(pi.metadata.booking_id);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.updateBookingFromPayment(pi.id, 'FAILED');
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          await this.updateBookingFromPayment(paymentIntentId, 'REFUNDED');
        }
        break;
      }
      default:
        break;
    }

    return { received: true, mode: 'tenant', tenant_slug, event: event.type };
  }

  async updateBookingFromPayment(payment_intent_id: string, payment_status: string, booking_status?: string) {
    const patch: any = {
      payment_status,
      updated_at: new Date().toISOString(),
    };

    if (booking_status) patch.booking_status = booking_status;

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(patch)
      .eq('stripe_payment_intent_id', payment_intent_id)
      .select('id')
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async triggerEvent(tenant_id: string, event_type: WebhookEvent, data: any) {
    const { data: webhooks } = await supabaseAdmin
      .from('tenant_webhooks')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .contains('events', [event_type]);

    if (!webhooks || webhooks.length === 0) return;

    const payload = {
      event: event_type,
      timestamp: new Date().toISOString(),
      tenant_id,
      data,
    };

    await Promise.allSettled(
      webhooks.map((wh: any) => this.deliverWebhook(wh, event_type, payload)),
    );
  }
}
