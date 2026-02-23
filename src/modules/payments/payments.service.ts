import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2026-01-28.clover',
    });
  }

  // =====================
  // Stripe Customer管理
  // =====================
  async getOrCreateStripeCustomer(user_id: string): Promise<string> {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (!profile) throw new NotFoundException('Profile not found');

    if (profile.stripe_customer_id) {
      return profile.stripe_customer_id as string;
    }

    const { data: authUserResp, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(user_id);
    if (authUserError || !authUserResp?.user?.email) {
      throw new BadRequestException('Cannot resolve user email for Stripe customer');
    }

    const customer = await this.stripe.customers.create({
      email: authUserResp.user.email,
      name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
      metadata: { user_id },
    });

    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user_id);

    return customer.id;
  }

  // =====================
  // 保存支付方式
  // =====================
  async savePaymentMethod(user_id: string, payment_method_id: string) {
    const stripe_customer_id = await this.getOrCreateStripeCustomer(user_id);

    await this.stripe.paymentMethods.attach(payment_method_id, {
      customer: stripe_customer_id,
    });

    await this.stripe.customers.update(stripe_customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    await supabaseAdmin
      .from('profiles')
      .update({ stripe_payment_method_id: payment_method_id })
      .eq('id', user_id);

    return { message: 'Payment method saved' };
  }

  async getSavedPaymentMethod(user_id: string) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, stripe_payment_method_id')
      .eq('id', user_id)
      .single();

    if (!profile?.stripe_payment_method_id) return null;

    try {
      const pm = await this.stripe.paymentMethods.retrieve(
        profile.stripe_payment_method_id as string,
      );

      if ('card' in pm && pm.card) {
        return {
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        };
      }

      return { id: pm.id };
    } catch {
      return null;
    }
  }

  // =====================
  // 创建Payment Intent（给前端用）
  // 兼容旧签名：createPaymentIntent(user_id, { booking_id })
  // =====================
  async createPaymentIntent(
    user_id: string,
    booking_or_dto: string | { booking_id?: string },
    tenant_id_param?: string,
  ) {
    const booking_id =
      typeof booking_or_dto === 'string'
        ? booking_or_dto
        : (booking_or_dto.booking_id ?? '');

    if (!booking_id) {
      throw new BadRequestException('booking_id is required');
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, tenant_id, total_price, currency, payment_status')
      .eq('id', booking_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    const tenant_id = tenant_id_param ?? (booking.tenant_id as string);

    if (booking.payment_status === 'PAID') {
      throw new BadRequestException('Booking already paid');
    }

    const stripe_customer_id = await this.getOrCreateStripeCustomer(user_id);
    const amount = Math.round(Number(booking.total_price ?? 0) * 100);

    const intent = await this.stripe.paymentIntents.create({
      amount,
      currency: String(booking.currency ?? 'AUD').toLowerCase(),
      customer: stripe_customer_id,
      setup_future_usage: 'off_session',
      metadata: {
        booking_id,
        tenant_id,
        user_id,
      },
    });

    await supabaseAdmin
      .from('bookings')
      .update({
        stripe_payment_intent_id: intent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id);

    return {
      client_secret: intent.client_secret,
      stripe_payment_intent_id: intent.id,
    };
  }

  // =====================
  // Admin Confirm → 直接扣款
  // =====================
  async chargeBooking(booking_id: string, tenant_id: string, admin_id: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(
        `*, profiles!bookings_passenger_id_fkey(stripe_customer_id, stripe_payment_method_id)`,
      )
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.payment_status === 'PAID') {
      throw new BadRequestException('Already paid');
    }

    const passenger = booking.profiles as
      | { stripe_customer_id?: string; stripe_payment_method_id?: string }
      | null;

    if (!passenger?.stripe_customer_id || !passenger?.stripe_payment_method_id) {
      throw new BadRequestException('No saved payment method for this passenger');
    }

    const amount = Math.round(Number(booking.total_price ?? 0) * 100);

    try {
      const intent = await this.stripe.paymentIntents.create({
        amount,
        currency: String(booking.currency ?? 'AUD').toLowerCase(),
        customer: passenger.stripe_customer_id,
        payment_method: passenger.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        metadata: {
          booking_id,
          tenant_id,
          charged_by: admin_id,
        },
      });

      await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'PAID',
          stripe_payment_intent_id: intent.id,
          stripe_payment_method_id: passenger.stripe_payment_method_id,
          charged_amount: booking.total_price,
          confirmed_by: admin_id,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);

      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'CHARGE',
        amount: Number(booking.total_price ?? 0),
        currency: String(booking.currency ?? 'AUD'),
        stripe_charge_id: (intent.latest_charge as string) ?? undefined,
        stripe_payment_intent_id: intent.id,
        note: 'Initial charge on confirm',
        processed_by: admin_id,
      });

      await supabaseAdmin.rpc('increment_total_spend', {
        p_user_id: booking.passenger_id,
        p_amount: booking.total_price,
      });

      return {
        message: 'Payment successful',
        charged_amount: booking.total_price,
        currency: booking.currency,
      };
    } catch (err: any) {
      throw new BadRequestException(`Payment failed: ${err.message}`);
    }
  }

  // =====================
  // Supplement（补收差价）
  // =====================
  async chargeSupplementAmount(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    dto: { supplement_amount: number; note?: string },
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(
        `*, profiles!bookings_passenger_id_fkey(stripe_customer_id, stripe_payment_method_id)`,
      )
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    const passenger = booking.profiles as
      | { stripe_customer_id?: string; stripe_payment_method_id?: string }
      | null;
    if (!passenger?.stripe_customer_id || !passenger?.stripe_payment_method_id) {
      throw new BadRequestException('No saved payment method');
    }

    const amount = Math.round(Number(dto.supplement_amount) * 100);

    try {
      const intent = await this.stripe.paymentIntents.create({
        amount,
        currency: String(booking.currency ?? 'AUD').toLowerCase(),
        customer: passenger.stripe_customer_id,
        payment_method: passenger.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        metadata: {
          booking_id,
          tenant_id,
          type: 'SUPPLEMENT',
          charged_by: admin_id,
        },
      });

      await supabaseAdmin
        .from('bookings')
        .update({
          supplement_amount:
            Number(booking.supplement_amount ?? 0) + Number(dto.supplement_amount),
          charged_amount:
            Number(booking.charged_amount ?? 0) + Number(dto.supplement_amount),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);

      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'SUPPLEMENT',
        amount: Number(dto.supplement_amount),
        currency: String(booking.currency ?? 'AUD'),
        stripe_charge_id: (intent.latest_charge as string) ?? undefined,
        stripe_payment_intent_id: intent.id,
        note: dto.note ?? 'Supplement charge',
        processed_by: admin_id,
      });

      const { data: booking_for_notify } = await supabaseAdmin
        .from('bookings')
        .select('*, profiles!bookings_passenger_id_fkey(email)')
        .eq('id', booking_id)
        .single();

      if (booking_for_notify) {
        await this.notificationsService.notifySupplementCharged(
          {
            ...booking_for_notify,
            booker_email: (booking_for_notify as any).profiles?.email,
          },
          dto.supplement_amount,
          dto.note,
        );
      }

      return {
        message: 'Supplement charged',
        supplement_amount: dto.supplement_amount,
      };
    } catch (err: any) {
      throw new BadRequestException(`Supplement failed: ${err.message}`);
    }
  }

  // =====================
  // Credit Note（退款）
  // =====================
  async issueCreditNote(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    dto: { credit_amount: number; note?: string },
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, stripe_payment_intent_id, currency')
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (!booking.stripe_payment_intent_id) {
      throw new BadRequestException('No payment intent found for this booking');
    }

    const intent = await this.stripe.paymentIntents.retrieve(
      booking.stripe_payment_intent_id as string,
    );
    const charge_id = intent.latest_charge as string;

    if (!charge_id) {
      throw new BadRequestException('No charge found to refund');
    }

    const amount = Math.round(Number(dto.credit_amount) * 100);

    try {
      const refund = await this.stripe.refunds.create({
        charge: charge_id,
        amount,
        metadata: {
          booking_id,
          tenant_id,
          type: 'CREDIT_NOTE',
          issued_by: admin_id,
        },
      });

      await supabaseAdmin
        .from('bookings')
        .update({
          credit_amount: Number(booking.credit_amount ?? 0) + Number(dto.credit_amount),
          charged_amount: Math.max(
            0,
            Number(booking.charged_amount ?? 0) - Number(dto.credit_amount),
          ),
          payment_status: 'PARTIALLY_REFUNDED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);

      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'CREDIT_NOTE',
        amount: -Number(dto.credit_amount),
        currency: String(booking.currency ?? 'AUD'),
        stripe_refund_id: refund.id,
        note: dto.note ?? 'Credit note issued',
        processed_by: admin_id,
      });

      const { data: booking_for_notify } = await supabaseAdmin
        .from('bookings')
        .select('*, profiles!bookings_passenger_id_fkey(email)')
        .eq('id', booking_id)
        .single();

      if (booking_for_notify) {
        await this.notificationsService.notifyCreditNoteIssued(
          {
            ...booking_for_notify,
            booker_email: (booking_for_notify as any).profiles?.email,
          },
          dto.credit_amount,
          dto.note,
        );
      }

      return {
        message: 'Credit note issued',
        credit_amount: dto.credit_amount,
        refund_id: refund.id,
      };
    } catch (err: any) {
      throw new BadRequestException(`Refund failed: ${err.message}`);
    }
  }

  // =====================
  // 全额退款（取消/No Show）
  // =====================
  async issueFullRefund(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    note?: string,
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, stripe_payment_intent_id, currency, charged_amount')
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (!booking.stripe_payment_intent_id) {
      await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'REFUNDED',
          refunded_amount: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);

      return { message: 'Booking cancelled (no charge)' };
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        metadata: {
          booking_id,
          tenant_id,
          type: 'FULL_REFUND',
          issued_by: admin_id,
        },
      });

      await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'REFUNDED',
          refunded_amount: booking.charged_amount,
          charged_amount: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);

      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'REFUND',
        amount: -Number(booking.charged_amount ?? 0),
        currency: String(booking.currency ?? 'AUD'),
        stripe_refund_id: refund.id,
        note: note ?? 'Full refund issued',
        processed_by: admin_id,
      });

      return {
        message: 'Full refund issued',
        refunded_amount: booking.charged_amount,
        refund_id: refund.id,
      };
    } catch (err: any) {
      throw new BadRequestException(`Refund failed: ${err.message}`);
    }
  }

  // =====================
  // Admin替客户下单 → 发确认邮件Token
  // =====================
  async createConfirmToken(booking_id: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from('booking_confirm_tokens').insert({
      booking_id,
      token,
      expires_at,
    });

    return token;
  }

  async validateConfirmToken(token: string) {
    const { data } = await supabaseAdmin
      .from('booking_confirm_tokens')
      .select('*, bookings(*)')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (!data) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (new Date(data.expires_at as string) < new Date()) {
      throw new BadRequestException('Confirmation link has expired');
    }

    return data;
  }

  async useConfirmToken(token: string, payment_method_id?: string) {
    const token_data = await this.validateConfirmToken(token);
    const booking = token_data.bookings as { id: string; passenger_id?: string | null };

    if (payment_method_id && booking.passenger_id) {
      await this.savePaymentMethod(booking.passenger_id, payment_method_id);
    }

    await supabaseAdmin
      .from('booking_confirm_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    return {
      booking_id: booking.id,
      passenger_id: booking.passenger_id,
    };
  }

  // =====================
  // 查询支付记录
  // =====================
  async getPaymentHistory(booking_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('booking_payments')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 兼容旧接口
  async getPaymentByBooking(booking_id: string, _passenger_id: string) {
    const { data, error } = await supabaseAdmin
      .from('booking_payments')
      .select('*')
      .eq('booking_id', booking_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) throw new NotFoundException('Payment not found');
    return data;
  }

  // 兼容旧接口
  async refund(booking_id: string, requested_by: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('tenant_id')
      .eq('id', booking_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');
    return this.issueFullRefund(booking_id, booking.tenant_id as string, requested_by);
  }

  // =====================
  // Stripe Webhook处理
  // 兼容旧签名：handleWebhook(payload, signature, tenant_id)
  // =====================
  async handleWebhook(payload: Buffer, signature: string, _tenant_id?: string) {
    const webhook_secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhook_secret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature failed: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_method.attached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        if (pm.customer) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', pm.customer as string)
            .single();

          if (profile) {
            await supabaseAdmin
              .from('profiles')
              .update({ stripe_payment_method_id: pm.id })
              .eq('id', profile.id);
          }
        }
        break;
      }
    }

    return { received: true };
  }

  private async handlePaymentSuccess(intent: Stripe.PaymentIntent) {
    const booking_id = intent.metadata?.booking_id;
    if (!booking_id) return;

    await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'PAID',
        stripe_payment_intent_id: intent.id,
        charged_amount: Number(intent.amount_received ?? 0) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .eq('payment_status', 'UNPAID');
  }

  private async handlePaymentFailed(intent: Stripe.PaymentIntent) {
    const booking_id = intent.metadata?.booking_id;
    if (!booking_id) return;

    // eslint-disable-next-line no-console
    console.error(
      `Payment failed for booking ${booking_id}:`,
      intent.last_payment_error?.message,
    );
  }

  // =====================
  // Revenue
  // =====================
  async getTenantRevenue(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('booking_payments')
      .select('amount, payment_type, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const total_revenue = (data ?? [])
      .filter((row: any) => ['CHARGE', 'SUPPLEMENT'].includes(row.payment_type))
      .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);

    return {
      transactions: data ?? [],
      summary: {
        total_revenue: parseFloat(total_revenue.toFixed(2)),
        transaction_count: (data ?? []).length,
      },
    };
  }

  // =====================
  // 辅助方法
  // =====================
  private async recordPayment(
    booking_id: string,
    tenant_id: string,
    dto: {
      payment_type: string;
      amount: number;
      currency?: string;
      stripe_charge_id?: string;
      stripe_refund_id?: string;
      stripe_payment_intent_id?: string;
      note?: string;
      processed_by?: string;
    },
  ) {
    await supabaseAdmin.from('booking_payments').insert({
      booking_id,
      tenant_id,
      payment_type: dto.payment_type,
      amount: dto.amount,
      currency: dto.currency ?? 'AUD',
      stripe_charge_id: dto.stripe_charge_id ?? null,
      stripe_refund_id: dto.stripe_refund_id ?? null,
      stripe_payment_intent_id: dto.stripe_payment_intent_id ?? null,
      status: 'COMPLETED',
      note: dto.note ?? null,
      processed_by: dto.processed_by ?? null,
    });
  }
}
