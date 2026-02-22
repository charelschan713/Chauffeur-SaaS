import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import { supabaseAdmin } from '../../config/supabase.config';
import { EmailTemplates } from './templates/email.templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  // 核心发送方法
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    booking_id?: string,
    user_id?: string,
  ) {
    try {
      await sgMail.send({
        to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: process.env.SENDGRID_FROM_NAME ?? 'Platform',
        },
        subject,
        html,
      });

      // 记录到notifications表
      if (user_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id,
          booking_id: booking_id ?? null,
          type: 'EMAIL',
          template: subject,
          status: 'SENT',
          sent_at: new Date().toISOString(),
        });
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      // 不抛出错误，通知失败不影响主业务流程
    }
  }

  // ── 业务触发方法 ──

  async notifyBookingConfirmed(booking_id: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        profiles!passenger_id(id, first_name, last_name),
        payments(amount, currency)
      `)
      .eq('id', booking_id)
      .single();

    if (!booking) return;

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(
      booking.profiles.id,
    );

    const template = EmailTemplates.bookingConfirmed({
      passenger_name: `${booking.profiles.first_name} ${booking.profiles.last_name}`,
      pickup_address: booking.pickup_address,
      dropoff_address: booking.dropoff_address,
      pickup_datetime: booking.pickup_datetime,
      vehicle_class: booking.vehicle_class,
      total_price: booking.total_price,
      currency: booking.currency,
      booking_id: booking.id,
    });

    await this.sendEmail(
      user.user!.email!,
      template.subject,
      template.html,
      booking_id,
      booking.profiles.id,
    );
  }

  async notifyDriverAssigned(booking_id: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        profiles!passenger_id(id, first_name, last_name),
        drivers!driver_id(
          user_id,
          profiles(first_name, last_name, phone),
          vehicles(make, model, color, plate_number)
        )
      `)
      .eq('id', booking_id)
      .single();

    if (!booking || !booking.drivers) return;

    const driver = booking.drivers;
    const vehicle = driver.vehicles?.[0];

    // 通知乘客
    const { data: passengerUser } = await supabaseAdmin.auth.admin.getUserById(
      booking.profiles.id,
    );

    const passengerTemplate = EmailTemplates.driverAssigned({
      passenger_name: `${booking.profiles.first_name} ${booking.profiles.last_name}`,
      driver_name: `${driver.profiles.first_name} ${driver.profiles.last_name}`,
      driver_phone: driver.profiles.phone ?? 'N/A',
      vehicle_make: vehicle?.make ?? '',
      vehicle_model: vehicle?.model ?? '',
      vehicle_color: vehicle?.color ?? '',
      plate_number: vehicle?.plate_number ?? '',
      pickup_datetime: booking.pickup_datetime,
    });

    await this.sendEmail(
      passengerUser.user!.email!,
      passengerTemplate.subject,
      passengerTemplate.html,
      booking_id,
      booking.profiles.id,
    );

    // 通知司机
    const { data: driverUser } = await supabaseAdmin.auth.admin.getUserById(
      driver.user_id,
    );

    const driverTemplate = EmailTemplates.newTripAssigned({
      driver_name: `${driver.profiles.first_name} ${driver.profiles.last_name}`,
      pickup_address: booking.pickup_address,
      dropoff_address: booking.dropoff_address,
      pickup_datetime: booking.pickup_datetime,
      passenger_count: booking.passenger_count,
      special_requests: booking.special_requests,
    });

    await this.sendEmail(
      driverUser.user!.email!,
      driverTemplate.subject,
      driverTemplate.html,
      booking_id,
      driver.user_id,
    );
  }

  async notifyTripCompleted(booking_id: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, profiles!passenger_id(id, first_name, last_name)')
      .eq('id', booking_id)
      .single();

    if (!booking) return;

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(
      booking.profiles.id,
    );

    const template = EmailTemplates.tripCompleted({
      passenger_name: `${booking.profiles.first_name} ${booking.profiles.last_name}`,
      pickup_address: booking.pickup_address,
      dropoff_address: booking.dropoff_address,
      total_price: booking.total_price,
      currency: booking.currency,
    });

    await this.sendEmail(
      user.user!.email!,
      template.subject,
      template.html,
      booking_id,
      booking.profiles.id,
    );
  }

  async notifyBookingCancelled(booking_id: string, refund_amount?: number) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, profiles!passenger_id(id, first_name, last_name)')
      .eq('id', booking_id)
      .single();

    if (!booking) return;

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(
      booking.profiles.id,
    );

    const template = EmailTemplates.bookingCancelled({
      passenger_name: `${booking.profiles.first_name} ${booking.profiles.last_name}`,
      booking_id: booking.id,
      refund_amount,
      currency: booking.currency,
    });

    await this.sendEmail(
      user.user!.email!,
      template.subject,
      template.html,
      booking_id,
      booking.profiles.id,
    );
  }

  async notifyTenantPendingApproval(tenant_id: string) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenant_id)
      .single();

    const { data: admin } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenant_id)
      .eq('role', 'TENANT_ADMIN')
      .single();

    if (!tenant || !admin) return;

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(admin.id);

    const template = EmailTemplates.tenantPendingApproval({
      admin_name: `${admin.first_name} ${admin.last_name}`,
      company_name: tenant.name,
    });

    await this.sendEmail(user.user!.email!, template.subject, template.html);
  }

  async notifyTenantApproved(tenant_id: string) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenant_id)
      .single();

    const { data: admin } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenant_id)
      .eq('role', 'TENANT_ADMIN')
      .single();

    if (!tenant || !admin) return;

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(admin.id);

    const template = EmailTemplates.tenantApproved({
      admin_name: `${admin.first_name} ${admin.last_name}`,
      company_name: tenant.name,
      dashboard_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    await this.sendEmail(user.user!.email!, template.subject, template.html);
  }
}
