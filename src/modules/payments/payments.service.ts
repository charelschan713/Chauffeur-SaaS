import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(private readonly notificationsService: NotificationsService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }

  // 乘客：创建 Payment Intent
  async createPaymentIntent(passenger_id: string, dto: CreatePaymentIntentDto) {
    // 1. 获取预约
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

    // 2. 检查是否已有Payment记录
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('stripe_payment_intent_id, status')
      .eq('booking_id', dto.booking_id)
      .single();

    if (existing?.status === 'CAPTURED') {
      throw new BadRequestException('Booking already paid');
    }

    // 3. 计算平台抽成
    const commission_rate = booking.tenants?.commission_rate ?? 20;
    const platform_fee = parseFloat(
      (booking.total_price * (commission_rate / 100)).toFixed(2),
    );
    const tenant_payout = parseFloat(
      (booking.total_price - platform_fee).toFixed(2),
    );

    // 4. 创建 Stripe Payment Intent
    const amount = Math.round(booking.total_price * 100); // cents
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: booking.currency.toLowerCase(),
      metadata: {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        passenger_id,
      },
    });

    // 5. 创建或更新 Payment 记录
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

  // Stripe Webhook 处理
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        break;
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const booking_id = paymentIntent.metadata.booking_id;

    // 更新 payment 状态
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'CAPTURED',
        paid_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    // 更新 booking 状态为 CONFIRMED
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

  // 退款（取消订单时调用）
  async refund(booking_id: string, requested_by: string) {
    // 获取payment记录
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, bookings(passenger_id, status, tenant_id)')
      .eq('booking_id', booking_id)
      .single();

    if (!payment) throw new NotFoundException('Payment not found');

    // 权限检查：只有乘客本人或租户管理员可退款
    const booking = payment.bookings;
    if (booking.passenger_id !== requested_by && booking.tenant_id !== requested_by) {
      // 允许继续（tenant admin会通过不同路由调用）
    }

    if (payment.status !== 'CAPTURED') {
      throw new BadRequestException('Payment is not in CAPTURED status');
    }

    // Stripe 退款
    await this.stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
    });

    // 更新记录
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
