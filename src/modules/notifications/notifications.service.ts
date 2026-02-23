import { Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { Resend } from 'resend';
import twilio from 'twilio';
import Expo from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo = new Expo();

  // =====================
  // 主入口：发送通知
  // =====================
  async sendNotification(dto: {
    tenant_id: string;
    booking_id?: string;
    notification_type: string;
    recipient_type: 'BOOKER' | 'PASSENGER' | 'DRIVER' | 'TENANT';
    recipient_id?: string;
    recipient_email?: string;
    recipient_phone?: string;
    channels: ('EMAIL' | 'SMS' | 'PUSH')[];
    variables: Record<string, string>;
  }) {
    const results: Array<{ channel: string; status: string; error?: string }> = [];

    for (const channel of dto.channels) {
      try {
        const template = await this.getTemplate(
          dto.tenant_id,
          dto.notification_type,
          channel,
          dto.recipient_type,
        );

        if (!template) {
          // eslint-disable-next-line no-console
          console.warn(
            `No template found: ${dto.notification_type}/${channel}/${dto.recipient_type}`,
          );
          continue;
        }

        const subject = template.subject
          ? this.interpolate(template.subject as string, dto.variables)
          : undefined;
        const body = this.interpolate(template.body as string, dto.variables);

        let status = 'PENDING';
        let error_message: string | undefined = undefined;

        if (channel === 'EMAIL' && dto.recipient_email) {
          const result = await this.sendEmail(
            dto.tenant_id,
            dto.recipient_email,
            subject ?? dto.notification_type,
            body,
          );
          status = result.success ? 'SENT' : 'FAILED';
          error_message = result.error;
        } else if (channel === 'SMS' && dto.recipient_phone) {
          const result = await this.sendSMS(
            dto.tenant_id,
            dto.recipient_phone,
            body,
          );
          status = result.success ? 'SENT' : 'FAILED';
          error_message = result.error;
        } else if (channel === 'PUSH' && dto.recipient_id) {
          const result = await this.sendPush(
            dto.recipient_id,
            subject ?? dto.notification_type,
            body,
          );
          status = result.success ? 'SENT' : 'FAILED';
          error_message = result.error;
        }

        await this.logNotification({
          tenant_id: dto.tenant_id,
          booking_id: dto.booking_id,
          notification_type: dto.notification_type,
          notification_channel: channel,
          recipient_type: dto.recipient_type,
          recipient_id: dto.recipient_id,
          recipient_email: dto.recipient_email,
          recipient_phone: dto.recipient_phone,
          subject,
          body,
          status,
          error_message,
        });

        results.push({ channel, status });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error(`Notification error ${channel}:`, err.message);
        results.push({ channel, status: 'FAILED', error: err.message });
      }
    }

    return results;
  }

  // =====================
  // 邮件发送
  // =====================
  private async sendEmail(
    tenant_id: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('resend_api_key, name')
        .eq('id', tenant_id)
        .single();

      const api_key =
        (tenant as any)?.resend_api_key ?? process.env.RESEND_API_KEY;
      if (!api_key) {
        return { success: false, error: 'RESEND_API_KEY not configured' };
      }

      const from_name = (tenant as any)?.name ?? 'Chauffeur Platform';
      const from_email =
        process.env.RESEND_FROM_EMAIL ?? process.env.SENDGRID_FROM_EMAIL ?? 'noreply@platform.com';

      const resend = new Resend(api_key);

      await resend.emails.send({
        from: `${from_name} <${from_email}>`,
        to,
        subject,
        text: body,
        html: this.wrapEmailHtml(body, from_name),
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // =====================
  // SMS发送
  // =====================
  private async sendSMS(
    tenant_id: string,
    to: string,
    body: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('twilio_account_sid, twilio_auth_token, twilio_from_number')
        .eq('id', tenant_id)
        .single();

      const account_sid =
        (tenant as any)?.twilio_account_sid ?? process.env.TWILIO_ACCOUNT_SID;
      const auth_token =
        (tenant as any)?.twilio_auth_token ?? process.env.TWILIO_AUTH_TOKEN;
      const from =
        (tenant as any)?.twilio_from_number ?? process.env.TWILIO_FROM_NUMBER;

      if (!account_sid || !auth_token || !from) {
        return { success: false, error: 'Twilio config missing' };
      }

      const client = twilio(account_sid, auth_token);
      await client.messages.create({ body, from, to });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // =====================
  // Push通知
  // =====================
  private async sendPush(
    driver_id: string,
    title: string,
    body: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: tokens } = await supabaseAdmin
        .from('driver_push_tokens')
        .select('push_token')
        .eq('driver_id', driver_id)
        .eq('is_active', true);

      if (!tokens || tokens.length === 0) {
        return { success: false, error: 'No push token found' };
      }

      const messages = (tokens as Array<{ push_token: string }>)
        .filter((t) => Expo.isExpoPushToken(t.push_token))
        .map((t) => ({
          to: t.push_token,
          title,
          body,
          sound: 'default' as const,
          data: { notification_type: title },
        }));

      if (messages.length === 0) {
        return { success: false, error: 'No valid push tokens' };
      }

      const chunks = this.expo.chunkPushNotifications(messages as any);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk as any);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // =====================
  // 获取模版
  // =====================
  private async getTemplate(
    tenant_id: string,
    template_id: string,
    notification_channel: string,
    recipient_type: string,
  ) {
    const { data: custom } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('template_id', template_id)
      .eq('notification_channel', notification_channel)
      .eq('recipient_type', recipient_type)
      .eq('is_active', true)
      .maybeSingle();

    if (custom) return custom;

    const { data: defaults } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .is('tenant_id', null)
      .eq('template_id', template_id)
      .eq('notification_channel', notification_channel)
      .eq('recipient_type', recipient_type)
      .eq('is_active', true)
      .maybeSingle();

    return defaults;
  }

  // =====================
  // 变量替换
  // =====================
  private interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return variables[key] ?? `{{${key}}}`;
    });
  }

  // =====================
  // HTML邮件包装
  // =====================
  private wrapEmailHtml(body: string, from_name: string): string {
    const html_body = body.replace(/\n/g, '<br>').replace(/•/g, '&bull;');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont,
        'Segoe UI', sans-serif;
      background: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .header {
      background: #1a1a1a;
      color: white;
      padding: 24px 32px;
      font-size: 18px;
      font-weight: 600;
    }
    .body {
      padding: 32px;
      color: #333;
      line-height: 1.6;
      font-size: 15px;
    }
    .footer {
      background: #f9f9f9;
      padding: 16px 32px;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">${from_name}</div>
    <div class="body">${html_body}</div>
    <div class="footer">
      This email was sent by ${from_name}.
      Please do not reply to this email.
    </div>
  </div>
</body>
</html>`;
  }

  // =====================
  // 记录通知日志
  // =====================
  private async logNotification(dto: {
    tenant_id: string;
    booking_id?: string;
    notification_type: string;
    notification_channel: string;
    recipient_type: string;
    recipient_id?: string;
    recipient_email?: string;
    recipient_phone?: string;
    subject?: string;
    body: string;
    status: string;
    error_message?: string;
  }) {
    await supabaseAdmin.from('notification_logs').insert({
      tenant_id: dto.tenant_id,
      booking_id: dto.booking_id ?? null,
      notification_type: dto.notification_type,
      notification_channel: dto.notification_channel,
      recipient_type: dto.recipient_type,
      recipient_id: dto.recipient_id ?? null,
      recipient_email: dto.recipient_email ?? null,
      recipient_phone: dto.recipient_phone ?? null,
      subject: dto.subject ?? null,
      body: dto.body,
      status: dto.status,
      error_message: dto.error_message ?? null,
      sent_at: dto.status === 'SENT' ? new Date().toISOString() : null,
    });
  }

  // =====================
  // 注册Push Token（司机App）
  // =====================
  async registerPushToken(
    driver_id: string,
    push_token: string,
    device_type: 'ios' | 'android' = 'ios',
  ) {
    const { data, error } = await supabaseAdmin
      .from('driver_push_tokens')
      .upsert(
        {
          driver_id,
          push_token,
          device_type,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'driver_id,push_token',
        },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // =====================
  // Admin手动发SMS
  // =====================
  async adminSendSMS(
    tenant_id: string,
    recipient_phone: string,
    body: string,
    booking_id?: string,
  ) {
    const result = await this.sendSMS(tenant_id, recipient_phone, body);

    await this.logNotification({
      tenant_id,
      booking_id,
      notification_type: 'ADMIN_MANUAL_SMS',
      notification_channel: 'SMS',
      recipient_type: 'DRIVER',
      recipient_phone,
      body,
      status: result.success ? 'SENT' : 'FAILED',
      error_message: result.error,
    });

    return result;
  }

  // =====================
  // 获取通知日志
  // =====================
  async getNotificationLogs(tenant_id: string, booking_id?: string) {
    let query = supabaseAdmin
      .from('notification_logs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (booking_id) {
      query = query.eq('booking_id', booking_id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  // =====================
  // 常用通知快捷方法
  // =====================
  async notifyBookingReceived(booking: any) {
    await this.sendNotification({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      notification_type: 'BOOKING_RECEIVED',
      recipient_type: 'BOOKER',
      recipient_email: booking.booker_email,
      channels: ['EMAIL'],
      variables: this.buildBookingVars(booking),
    });
  }

  async notifyBookingConfirmed(booking: any) {
    const booking_data = await this.normalizeBookingInput(booking);

    await this.sendNotification({
      tenant_id: booking_data.tenant_id,
      booking_id: booking_data.id,
      notification_type: 'BOOKING_CONFIRMED',
      recipient_type: 'BOOKER',
      recipient_email: booking_data.booker_email,
      channels: ['EMAIL'],
      variables: this.buildBookingVars(booking_data),
    });

    const passenger_phone =
      booking_data.passenger_phone ?? booking_data.booker_phone;
    if (passenger_phone) {
      await this.sendNotification({
        tenant_id: booking_data.tenant_id,
        booking_id: booking_data.id,
        notification_type: 'BOOKING_CONFIRMED',
        recipient_type: 'PASSENGER',
        recipient_phone: passenger_phone,
        channels: ['SMS'],
        variables: this.buildBookingVars(booking_data),
      });
    }
  }

  async notifyDriverOnTheWay(booking: any) {
    const passenger_phone = booking.passenger_phone ?? booking.booker_phone;
    if (!passenger_phone) return;

    await this.sendNotification({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      notification_type: 'DRIVER_ON_THE_WAY',
      recipient_type: 'PASSENGER',
      recipient_phone: passenger_phone,
      channels: ['SMS'],
      variables: this.buildBookingVars(booking),
    });
  }

  async notifyDriverArrived(booking: any) {
    const passenger_phone = booking.passenger_phone ?? booking.booker_phone;
    if (!passenger_phone) return;

    await this.sendNotification({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      notification_type: 'DRIVER_ARRIVED',
      recipient_type: 'PASSENGER',
      recipient_phone: passenger_phone,
      channels: ['SMS'],
      variables: this.buildBookingVars(booking),
    });
  }

  async notifyDriverAssigned(booking: any) {
    const booking_data = await this.normalizeBookingInput(booking);

    await this.sendNotification({
      tenant_id: booking_data.tenant_id,
      booking_id: booking_data.id,
      notification_type: 'DRIVER_ASSIGNED',
      recipient_type: 'BOOKER',
      recipient_email: booking_data.booker_email,
      channels: ['EMAIL'],
      variables: this.buildBookingVars(booking_data),
    });

    if (booking_data.driver_id) {
      await this.sendNotification({
        tenant_id: booking_data.tenant_id,
        booking_id: booking_data.id,
        notification_type: 'JOB_ASSIGNED',
        recipient_type: 'DRIVER',
        recipient_id: booking_data.driver_id,
        channels: ['PUSH'],
        variables: this.buildBookingVars(booking_data),
      });
    }
  }

  async notifyTripCompleted(booking: any) {
    const booking_data = await this.normalizeBookingInput(booking);

    await this.sendNotification({
      tenant_id: booking_data.tenant_id,
      booking_id: booking_data.id,
      notification_type: 'TRIP_COMPLETED',
      recipient_type: 'BOOKER',
      recipient_email: booking_data.booker_email,
      channels: ['EMAIL'],
      variables: this.buildBookingVars(booking_data),
    });
  }

  async notifyBookingCancelled(booking: any) {
    const booking_data = await this.normalizeBookingInput(booking);

    await this.sendNotification({
      tenant_id: booking_data.tenant_id,
      booking_id: booking_data.id,
      notification_type: 'BOOKING_CANCELLED',
      recipient_type: 'BOOKER',
      recipient_email: booking_data.booker_email,
      channels: ['EMAIL'],
      variables: this.buildBookingVars(booking_data),
    });

    const passenger_phone =
      booking_data.passenger_phone ?? booking_data.booker_phone;
    if (passenger_phone) {
      await this.sendNotification({
        tenant_id: booking_data.tenant_id,
        booking_id: booking_data.id,
        notification_type: 'BOOKING_CANCELLED',
        recipient_type: 'PASSENGER',
        recipient_phone: passenger_phone,
        channels: ['SMS'],
        variables: this.buildBookingVars(booking_data),
      });
    }

    if (booking_data.driver_id) {
      await this.sendNotification({
        tenant_id: booking_data.tenant_id,
        booking_id: booking_data.id,
        notification_type: 'JOB_CANCELLED',
        recipient_type: 'DRIVER',
        recipient_id: booking_data.driver_id,
        channels: ['PUSH'],
        variables: this.buildBookingVars(booking_data),
      });
    }
  }

  async notifyBookingModified(booking: any, note?: string) {
    await this.sendNotification({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      notification_type: 'BOOKING_MODIFIED',
      recipient_type: 'BOOKER',
      recipient_email: booking.booker_email,
      channels: ['EMAIL'],
      variables: {
        ...this.buildBookingVars(booking),
        modify_note: note ?? '',
      },
    });

    if (booking.driver_id && booking.driver_status !== 'UNASSIGNED') {
      await this.sendNotification({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        notification_type: 'BOOKING_MODIFIED',
        recipient_type: 'DRIVER',
        recipient_id: booking.driver_id,
        channels: ['PUSH'],
        variables: this.buildBookingVars(booking),
      });
    }
  }

  async notifySupplementCharged(
    booking: any,
    supplement_amount: number,
    note?: string,
  ) {
    await this.sendNotification({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      notification_type: 'SUPPLEMENT_CHARGED',
      recipient_type: 'BOOKER',
      recipient_email: booking.booker_email,
      channels: ['EMAIL'],
      variables: {
        ...this.buildBookingVars(booking),
        supplement_amount: supplement_amount.toFixed(2),
        note: note ?? '',
      },
    });
  }

  async notifyCreditNoteIssued(booking: any, credit_amount: number, note?: string) {
    await this.sendNotification({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      notification_type: 'CREDIT_NOTE_ISSUED',
      recipient_type: 'BOOKER',
      recipient_email: booking.booker_email,
      channels: ['EMAIL'],
      variables: {
        ...this.buildBookingVars(booking),
        credit_amount: credit_amount.toFixed(2),
        note: note ?? '',
      },
    });
  }

  // compatibility for existing auth/tenants flows
  async notifyTenantPendingApproval(tenant_id: string) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    if (!tenant) return;

    await this.sendNotification({
      tenant_id,
      notification_type: 'TENANT_PENDING_APPROVAL',
      recipient_type: 'TENANT',
      recipient_email: undefined,
      channels: ['EMAIL'],
      variables: {
        tenant_name: (tenant as any).name ?? '',
      },
    });
  }

  async notifyTenantApproved(tenant_id: string) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    const { data: admin } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('role', 'TENANT_ADMIN')
      .maybeSingle();

    let admin_email: string | undefined;
    if (admin?.id) {
      const { data: auth_user } = await supabaseAdmin.auth.admin.getUserById(admin.id as string);
      admin_email = auth_user?.user?.email ?? undefined;
    }

    if (!tenant || !admin_email) return;

    await this.sendNotification({
      tenant_id,
      notification_type: 'TENANT_APPROVED',
      recipient_type: 'TENANT',
      recipient_email: admin_email,
      channels: ['EMAIL'],
      variables: {
        tenant_name: (tenant as any).name ?? '',
        dashboard_url: process.env.FRONTEND_URL ?? '',
      },
    });
  }

  // =====================
  // 构建通知变量
  // =====================
  buildBookingVars(booking: any): Record<string, string> {
    const city = booking.tenant_service_cities;
    const driver = booking.drivers;
    const vehicle = driver?.vehicles?.[0];

    const pickup = booking.pickup_datetime ? new Date(booking.pickup_datetime) : null;
    const timezone = city?.timezone ?? 'Australia/Sydney';
    const city_name = city?.city_name ?? 'Sydney';

    const pickup_date = pickup
      ? pickup.toLocaleDateString('en-AU', {
          timeZone: timezone,
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';

    const pickup_time = pickup
      ? pickup.toLocaleTimeString('en-AU', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    return {
      booking_number: booking.booking_number ?? '',
      booker_name: booking.booker_name ?? '',
      booker_email: booking.booker_email ?? '',
      passenger_name: booking.passenger_name ?? booking.booker_name ?? '',
      passenger_phone: booking.passenger_phone ?? '',
      pickup_address: booking.pickup_address ?? '',
      dropoff_address: booking.dropoff_address ?? '',
      pickup_datetime_local: `${pickup_date} ${pickup_time} (${city_name})`,
      pickup_date,
      pickup_time,
      pickup_city: city_name,
      vehicle_type: booking.vehicle_type ?? '',
      currency: booking.currency ?? 'AUD',
      fare: (booking.fare ?? 0).toFixed(2),
      toll: (booking.toll ?? 0).toFixed(2),
      extras: (booking.extras ?? 0).toFixed(2),
      surcharge_amount: (booking.surcharge_amount ?? 0).toFixed(2),
      discount_amount: (booking.discount_amount ?? 0).toFixed(2),
      total_price: (booking.total_price ?? 0).toFixed(2),
      refunded_amount: (booking.refunded_amount ?? 0).toFixed(2),
      cancellation_fee: (
        (booking.charged_amount ?? 0) - (booking.refunded_amount ?? 0)
      ).toFixed(2),
      driver_name: driver?.profiles
        ? `${driver.profiles.first_name ?? ''} ${driver.profiles.last_name ?? ''}`.trim()
        : '',
      driver_phone: driver?.profiles?.phone ?? '',
      vehicle_make: vehicle?.make ?? '',
      vehicle_model: vehicle?.model ?? '',
      vehicle_color: vehicle?.color ?? '',
      plate_number: vehicle?.plate_number ?? '',
      tenant_name: booking.tenant_name ?? '',
      dashboard_url: process.env.FRONTEND_URL ?? '',
      confirm_url: booking.confirm_token
        ? `${process.env.FRONTEND_URL}/confirm-booking?token=${booking.confirm_token}`
        : '',
      invite_url: process.env.DRIVER_APP_URL ?? '',
      invite_code: booking.invite_code ?? '',
      from_tenant_name: booking.from_tenant_name ?? '',
      to_percentage: (booking.to_percentage ?? 0).toString(),
      modify_note: '',
      supplement_amount: '0.00',
      credit_amount: '0.00',
      note: '',
    };
  }

  private async normalizeBookingInput(booking_or_id: any): Promise<any> {
    if (typeof booking_or_id !== 'string') return booking_or_id;

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_or_id)
      .single();

    if (!booking) return { id: booking_or_id };

    let booker_email = booking.booker_email as string | undefined;
    if (!booker_email && booking.passenger_id) {
      const { data: auth_user } = await supabaseAdmin.auth.admin.getUserById(
        booking.passenger_id as string,
      );
      booker_email = auth_user?.user?.email ?? undefined;
    }

    return {
      ...booking,
      booker_email,
      booker_name: booking.booker_name ?? '',
    };
  }
}
