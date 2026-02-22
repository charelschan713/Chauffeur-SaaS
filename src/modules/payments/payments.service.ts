import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantKeysService } from '../tenants/tenant-keys.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly tenantKeysService: TenantKeysService,
  ) {}

  // 动态获取租户Stripe实例
  private async getStripeForTenant(tenant_id: string): Promise<Stripe> {
    const keys = await this.tenantKeysService.getDecryptedKeys(tenant_id);
    if (!keys.stripe_secret_key) {
      throw new BadRequestException(
        'Stripe not configured. Please add your Stripe API key in settings.',
      );
    }
    return new Stripe(keys.stripe_secret_key, {
      apiVersion: '2026-01-28.clover',
    });
  }

  // 乘客：创建 Payment Intent
  async createPaymentIntent(passenger_id: string, dto: CreatePaymentIntentDto) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, tenants(commission_rate)')
      .eq('id', dto.booking_id)
      .eq('passenger_id', passenger_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Booking is not in PENDING status');
    }

    // 用租户自己的Stripe
    const stripe = await this.getStripeForTenant(booking.tenant_id);

    const commission_rate = booking.tenants?.commission_rate ?? 20;
    const platform_fee = parseFloat(
      (booking.total_price * (commission_rate / 100)).toFixed(2),
    );
    const tenant_payout = parseFloat(
      (booking.total_price - platform_fee).toFixed(2),
    );

    const amount = Math.round(booking.total_price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: booking.currency.toLowerCase(),
      metadata: {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        passenger_id,
      },
    });

    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('stripe_payment_intent_id, status')
      .eq('booking_id', dto.booking_id)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('payments')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('booking_id', dto.booking_id);
    } else {
      await supabaseAdmin.from('payments').insert({
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        amount: booking.total_price,
        currency: booking.currency,
        payment_method: 'CARD',
        status: 'PENDING',
        stripe_payment_intent_id: paymentIntent.id,
        platform_fee,
        tenant_payout,
      });
    }

    return {
      client_secret: paymentIntent.client_secret,
      amount: booking.total_price,
      currency: booking.currency,
    };
  }

  // handleWebhook 改为动态验证
  async handleWebhook(rawBody: Buffer, signature: string, tenant_id: string) {
    const keys = await this.tenantKeysService.getDecryptedKeys(tenant_id);
    if (!keys.stripe_webhook_secret) {
      throw new BadRequestException('Stripe webhook not configured');
    }

    const stripe = await this.getStripeForTenant(tenant_id);
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        keys.stripe_webhook_secret,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const booking_id = paymentIntent.metadata.booking_id;

    await supabaseAdmin
      .from('payments')
      .update({
        status: 'CAPTURED',
        paid_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    await supabaseAdmin
      .from('bookings')
      .update({ status: 'CONFIRMED' })
      .eq('id', booking_id);

    await this.notificationsService.notifyBookingConfirmed(booking_id);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'FAILED' })
      .eq('stripe_payment_intent_id', paymentIntent.id);
  }

  // refund 改为动态Stripe
  async refund(booking_id: string, requested_by: string) {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, bookings(passenger_id, status, tenant_id)')
      .eq('booking_id', booking_id)
      .single();

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'CAPTURED') {
      throw new BadRequestException('Payment is not capturable');
    }

    const stripe = await this.getStripeForTenant(payment.tenant_id);
    await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
    });

    await supabaseAdmin
      .from('payments')
      .update({ status: 'REFUNDED' })
      .eq('id', payment.id);

    await supabaseAdmin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', booking_id);

    return { message: 'Refund processed successfully' };
  }

  // 乘客查看支付记录
  async getPaymentByBooking(booking_id: string, passenger_id: string) {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*, bookings!inner(passenger_id)')
      .eq('booking_id', booking_id)
      .eq('bookings.passenger_id', passenger_id)
      .single();

    if (error || !data) throw new NotFoundException('Payment not found');
    return data;
  }

  // TENANT_ADMIN：查看本租户收入汇总
  async getTenantRevenue(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('amount, platform_fee, tenant_payout, currency, paid_at')
      .eq('tenant_id', tenant_id)
      .eq('status', 'CAPTURED')
      .order('paid_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const total_revenue = data.reduce((s, p) => s + p.tenant_payout, 0);
    const total_platform_fee = data.reduce((s, p) => s + p.platform_fee, 0);

    return {
      transactions: data,
      summary: {
        total_revenue: parseFloat(total_revenue.toFixed(2)),
        total_platform_fee: parseFloat(total_platform_fee.toFixed(2)),
        transaction_count: data.length,
      },
    };
  }
}
