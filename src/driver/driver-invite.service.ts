import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationService } from '../notification/notification.service';

export interface InviteDriverDto {
  display_name?: string;
  email?: string;
  phone_country_code?: string;
  phone_number?: string;
  invite_type: 'INTERNAL' | 'EXTERNAL';
}

@Injectable()
export class DriverInviteService {
  constructor(
    private readonly db: DataSource,
    private readonly notify: NotificationService,
  ) {}

  // ─── Admin: Send Invite ──────────────────────────────────────────────────

  async inviteDriver(tenantId: string, invitedBy: string, dto: InviteDriverDto) {
    if (!dto.email && !dto.phone_number) {
      throw new BadRequestException('At least one of email or phone number is required');
    }

    // Get tenant info for branding
    const [tenant] = await this.db.query(
      `SELECT id, name, slug FROM public.tenants WHERE id = $1`,
      [tenantId],
    );

    const [invitation] = await this.db.query(
      `INSERT INTO public.driver_invitations
         (tenant_id, invited_by, display_name, email,
          phone_country_code, phone_number, invite_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, token`,
      [
        tenantId, invitedBy,
        dto.display_name ?? null,
        dto.email ?? null,
        dto.phone_country_code ?? '+61',
        dto.phone_number ?? null,
        dto.invite_type,
      ],
    );

    const onboardUrl = `https://onboard.${tenant.slug}.aschauffeured.com.au/onboard?token=${invitation.token}`;
    const recipientName = dto.display_name ?? 'there';

    // Send SMS if phone provided
    if (dto.phone_number) {
      await this.notify.handleEvent('DriverInviteSms', {
        tenant_id: tenantId,
        phone: `${dto.phone_country_code ?? '+61'}${dto.phone_number}`,
        name: recipientName,
        company_name: tenant.name,
        onboard_url: onboardUrl,
      }).catch(() => {/* non-fatal */});
    }

    // Send email if email provided
    if (dto.email) {
      await this.notify.handleEvent('DriverInviteEmail', {
        tenant_id: tenantId,
        to_email: dto.email,
        name: recipientName,
        company_name: tenant.name,
        onboard_url: onboardUrl,
        invite_type: dto.invite_type,
      }).catch(() => {/* non-fatal */});
    }

    return {
      invitation_id: invitation.id,
      onboard_url: onboardUrl,
      message: `Invitation sent${dto.phone_number ? ' via SMS' : ''}${dto.email ? ' via email' : ''}`,
    };
  }

  async listInvitations(tenantId: string) {
    return this.db.query(
      `SELECT di.*, u.full_name AS invited_by_name
       FROM public.driver_invitations di
       JOIN public.users u ON u.id = di.invited_by
       WHERE di.tenant_id = $1
       ORDER BY di.created_at DESC`,
      [tenantId],
    );
  }

  async cancelInvitation(tenantId: string, invitationId: string) {
    await this.db.query(
      `UPDATE public.driver_invitations
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'`,
      [invitationId, tenantId],
    );
    return { success: true };
  }

  // ─── Public: Resolve Token ────────────────────────────────────────────────

  async resolveToken(token: string) {
    const [inv] = await this.db.query(
      `SELECT di.id, di.tenant_id, di.invite_type, di.status, di.expires_at,
              di.display_name, di.email, di.phone_country_code, di.phone_number,
              t.name AS company_name, t.slug
       FROM public.driver_invitations di
       JOIN public.tenants t ON t.id = di.tenant_id
       WHERE di.token = $1`,
      [token],
    );
    if (!inv) throw new NotFoundException('Invitation not found or invalid link');
    if (inv.status === 'ACCEPTED') throw new BadRequestException('This invitation has already been used');
    if (inv.status === 'CANCELLED') throw new BadRequestException('This invitation has been cancelled');
    if (new Date(inv.expires_at) < new Date()) {
      await this.db.query(
        `UPDATE public.driver_invitations SET status = 'EXPIRED' WHERE id = $1`,
        [inv.id],
      );
      throw new BadRequestException('This invitation has expired. Please contact your employer for a new invite.');
    }
    return inv;
  }

  // ─── Public: Submit Onboarding ───────────────────────────────────────────

  async submitOnboarding(token: string, dto: {
    first_name: string;
    last_name: string;
    email: string;
    phone_country_code?: string;
    phone_number?: string;
    licence_number: string;
    licence_state: string;
    licence_expiry: string;
    tax_file_number?: string;
    abn?: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
    // External only
    driving_record_url?: string;
    criminal_record_url?: string;
  }) {
    const inv = await this.resolveToken(token);

    // Validate required for external
    if (inv.invite_type === 'EXTERNAL') {
      if (!dto.driving_record_url || !dto.criminal_record_url) {
        throw new BadRequestException('Driving record and criminal record check are required for external drivers');
      }
    }

    // Check if user already exists by email
    let userId: string;
    const [existingUser] = await this.db.query(
      `SELECT id FROM public.users WHERE email = $1`,
      [dto.email],
    );

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create Supabase auth user via admin API — app layer signs them up
      // For now, create user record in public.users
      const [newUser] = await this.db.query(
        `INSERT INTO public.users (email, full_name, phone_country_code, phone_number)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          dto.email,
          `${dto.first_name} ${dto.last_name}`,
          dto.phone_country_code ?? inv.phone_country_code ?? '+61',
          dto.phone_number ?? inv.phone_number ?? null,
        ],
      );
      userId = newUser.id;
    }

    // Upsert driver_profile
    await this.db.query(
      `INSERT INTO public.driver_profiles
         (user_id, first_name, last_name, email,
          phone_country_code, phone_number,
          licence_number, licence_state, licence_expiry,
          tax_file_number, abn,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
          driving_record_url, criminal_record_url,
          source_type, approval_status, onboarding_status, invitation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         email = EXCLUDED.email,
         phone_country_code = EXCLUDED.phone_country_code,
         phone_number = EXCLUDED.phone_number,
         licence_number = EXCLUDED.licence_number,
         licence_state = EXCLUDED.licence_state,
         licence_expiry = EXCLUDED.licence_expiry,
         tax_file_number = EXCLUDED.tax_file_number,
         abn = EXCLUDED.abn,
         emergency_contact_name = EXCLUDED.emergency_contact_name,
         emergency_contact_phone = EXCLUDED.emergency_contact_phone,
         emergency_contact_relationship = EXCLUDED.emergency_contact_relationship,
         driving_record_url = EXCLUDED.driving_record_url,
         criminal_record_url = EXCLUDED.criminal_record_url,
         onboarding_status = EXCLUDED.onboarding_status,
         updated_at = NOW()`,
      [
        userId,
        dto.first_name, dto.last_name, dto.email,
        dto.phone_country_code ?? inv.phone_country_code ?? '+61',
        dto.phone_number ?? inv.phone_number ?? null,
        dto.licence_number, dto.licence_state, dto.licence_expiry,
        dto.tax_file_number ?? null, dto.abn ?? null,
        dto.emergency_contact_name, dto.emergency_contact_phone, dto.emergency_contact_relationship,
        dto.driving_record_url ?? null, dto.criminal_record_url ?? null,
        inv.invite_type,
        // Internal auto-approved; External pending review
        inv.invite_type === 'INTERNAL' ? 'APPROVED' : 'PENDING',
        inv.invite_type === 'INTERNAL' ? 'APPROVED' : 'SUBMITTED',
        inv.id,
      ],
    );

    // Create driver membership for internal (active); external pending platform review
    const membershipStatus = inv.invite_type === 'INTERNAL' ? 'active' : 'invited';
    await this.db.query(
      `INSERT INTO public.memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, 'driver', $3)
       ON CONFLICT DO NOTHING`,
      [inv.tenant_id, userId, membershipStatus],
    );

    // Mark invitation accepted
    await this.db.query(
      `UPDATE public.driver_invitations
       SET status = 'ACCEPTED', accepted_at = NOW(), user_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [inv.id, userId],
    );

    return {
      success: true,
      type: inv.invite_type,
      message: inv.invite_type === 'INTERNAL'
        ? 'Welcome! Your driver account is ready. Download the driver app to get started.'
        : 'Thank you! Your application has been submitted for review. You will be notified once approved.',
    };
  }
}
