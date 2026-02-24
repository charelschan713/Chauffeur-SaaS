import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { supabaseAdmin } from '../../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DriverInvitationsService {
  constructor(private readonly notificationsService: NotificationsService) {}

  private generateToken() {
    return randomBytes(24).toString('hex');
  }

  private inviteUrl(token: string) {
    const base = process.env.DRIVER_INVITE_URL ?? `${process.env.FRONTEND_URL ?? ''}/driver/accept-invite`;
    return `${base}?token=${token}`;
  }

  async inviteByEmail(tenant_id: string, invited_by: string, email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Email is required');

    const token = this.generateToken();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error } = await supabaseAdmin
      .from('driver_invitations')
      .insert({ tenant_id, email: normalized, invited_by, token, expires_at })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new BadRequestException('RESEND_API_KEY not configured');

    const resend = new Resend(resendKey);
    const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@platform.com';
    const url = this.inviteUrl(token);

    await resend.emails.send({
      from: `Chauffeur Platform <${from}>`,
      to: normalized,
      subject: 'Driver Invitation',
      text: `You are invited as a driver. Accept invitation: ${url}`,
      html: `<p>You are invited as a driver.</p><p><a href="${url}">Accept invitation</a></p>`,
    });

    return { success: true, invitation };
  }

  async inviteBySMS(tenant_id: string, invited_by: string, phone: string) {
    const normalized = phone.trim();
    if (!normalized) throw new BadRequestException('Phone is required');

    const token = this.generateToken();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error } = await supabaseAdmin
      .from('driver_invitations')
      .insert({ tenant_id, phone: normalized, invited_by, token, expires_at })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const sms = await this.notificationsService.adminSendSMS(
      tenant_id,
      normalized,
      `You are invited as a driver. Accept invitation: ${this.inviteUrl(token)}`,
    );

    if (!sms.success) {
      throw new BadRequestException(sms.error ?? 'Failed to send SMS invitation');
    }

    return { success: true, invitation };
  }

  async testSMS(tenant_id: string, driver_id: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, phone')
      .eq('id', driver_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!driver?.phone) throw new NotFoundException('Driver phone not found');

    const result = await this.notificationsService.adminSendSMS(
      tenant_id,
      driver.phone,
      'Test SMS from AS Chauffeur platform',
    );

    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Failed to send test SMS');
    }

    return { success: true };
  }

  async acceptInvitation(token: string, dto: any) {
    const { data: invitation, error } = await supabaseAdmin
      .from('driver_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'PENDING')
      .single();

    if (error || !invitation) throw new NotFoundException('Invitation not found');
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from('driver_invitations').update({ status: 'EXPIRED' }).eq('id', invitation.id);
      throw new BadRequestException('Invitation expired');
    }

    const email = (dto.email ?? invitation.email ?? '').trim().toLowerCase();
    const phone = (dto.phone ?? invitation.phone ?? '').trim();
    const password = dto.password;

    if (!password) throw new BadRequestException('Password is required');
    if (!email && !phone) throw new BadRequestException('Email or phone is required');

    const userPayload: any = {
      password,
      user_metadata: {
        first_name: dto.first_name ?? '',
        last_name: dto.last_name ?? '',
      },
    };

    if (email) {
      userPayload.email = email;
      userPayload.email_confirm = true;
    } else {
      userPayload.phone = phone;
      userPayload.phone_confirm = true;
    }

    const created = await supabaseAdmin.auth.admin.createUser(userPayload);
    if (created.error || !created.data.user) {
      throw new BadRequestException(created.error?.message ?? 'Failed to create driver user');
    }

    const userId = created.data.user.id;

    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: invitation.tenant_id,
      role: 'DRIVER',
      first_name: dto.first_name ?? '',
      last_name: dto.last_name ?? '',
      phone: phone || null,
      email: email || null,
      is_active: true,
    });

    const { error: driverError } = await supabaseAdmin.from('drivers').upsert({
      tenant_id: invitation.tenant_id,
      user_id: userId,
      email: email || null,
      phone: phone || null,
      first_name: dto.first_name ?? '',
      last_name: dto.last_name ?? '',
      license_number: dto.license_number ?? null,
      is_active: true,
    }, { onConflict: 'user_id' });

    if (driverError) throw new BadRequestException(driverError.message);

    await supabaseAdmin
      .from('driver_invitations')
      .update({ status: 'ACCEPTED' })
      .eq('id', invitation.id);

    return { success: true, user_id: userId };
  }
}
