import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';


interface UserIdentity {
  sub: string;
  isPlatformAdmin: boolean;
}

interface JwtPayload {
  sub: string;
  tenant_id: string | null;
  isPlatformAdmin: boolean;
  role: string | null;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    // Auto-migrate: add sms_otp columns to users table
    await this.dataSource.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS sms_otp text,
        ADD COLUMN IF NOT EXISTS sms_otp_expires_at timestamptz
    `).catch(() => { /* columns may already exist */ });
  }

  private hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token + process.env.JWT_REFRESH_SECRET!)
      .digest('hex');
  }

  async login(email: string, password: string, tenantSlug?: string) {
    const rows = await this.dataSource.query(
      `select id, is_platform_admin, password_hash from public.users
       where email = $1`,
      [email],
    );
    if (!rows.length)
      throw new UnauthorizedException('Invalid credentials');

    const user = rows[0];
    if (!user.password_hash)
      throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    let memberships: any[];
    if (tenantSlug) {
      // Slug-scoped login: driver must have active membership in the specified tenant
      memberships = await this.dataSource.query(
        `select m.tenant_id, m.role, t.status as tenant_status
         from public.memberships m
         join public.tenants t on t.id = m.tenant_id
         where m.user_id = $1 and m.status = 'active'
           and lower(t.slug) = lower($2)
         limit 1`,
        [user.id, tenantSlug],
      );
      if (!memberships.length) {
        throw new UnauthorizedException('Company not found or you do not have access');
      }
    } else {
      memberships = await this.dataSource.query(
        `select m.tenant_id, m.role, t.status as tenant_status
         from public.memberships m
         left join public.tenants t on t.id = m.tenant_id
         where m.user_id = $1 and m.status = 'active'
         limit 1`,
        [user.id],
      );
    }

    const tenantId = memberships[0]?.tenant_id ?? null;
    const role = memberships[0]?.role ?? (user.is_platform_admin ? 'tenant_admin' : null);

    // Block login for archived/suspended tenants (non-platform admins)
    if (tenantId && !user.is_platform_admin) {
      const tenantStatus = memberships[0]?.tenant_status;
      if (tenantStatus === 'archived' || tenantStatus === 'suspended') {
        throw new UnauthorizedException('Account suspended');
      }
    }

    return this.issueTokens(
      {
        sub: user.id,
        isPlatformAdmin: user.is_platform_admin,
      },
      tenantId,
      role,
    );
  }


  async register(email: string, password: string, fullName?: string) {
    const hash = await bcrypt.hash(password, 10);
    const rows = await this.dataSource.query(
      `insert into public.users (email, full_name, password_hash, is_platform_admin)
       values ($1, $2, $3, false)
       on conflict (email) do update
         set password_hash = excluded.password_hash
       returning id, email`,
      [email, fullName ?? null, hash],
    );
    return rows[0];
  }
  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);

    const rows = await this.dataSource.query(
      `select * from public.refresh_tokens
       where token_hash = $1
       and revoked_at is null
       and expires_at > now()`,
      [hash],
    );

    if (!rows.length)
      throw new UnauthorizedException('Invalid refresh token');

    const stored = rows[0];
    const age = Date.now() - new Date(stored.created_at).getTime();
    if (age < 5000)
      throw new ForbiddenException('Replay detected');

    await this.dataSource.query(
      `update public.refresh_tokens
       set revoked_at = now()
       where token_hash = $1`,
      [hash],
    );

    const userRows = await this.dataSource.query(
      `select id, is_platform_admin from public.users
       where id = $1`,
      [stored.user_id],
    );

    const user = userRows[0];
    const role = await this.resolveRole(stored.user_id, stored.tenant_id, user.is_platform_admin);

    return this.issueTokens(
      {
        sub: stored.user_id,
        isPlatformAdmin: user.is_platform_admin,
      },
      stored.tenant_id,
      role,
    );
  }

  async switchTenant(
    userId: string,
    newTenantId: string,
    currentRefreshToken: string,
  ) {
    const membership = await this.dataSource.query(
      `select status, role from public.memberships
       where tenant_id = $1 and user_id = $2`,
      [newTenantId, userId],
    );

    if (!membership.length || membership[0].status !== 'active')
      throw new ForbiddenException('No access to tenant');

    const hash = this.hashToken(currentRefreshToken);
    await this.dataSource.query(
      `update public.refresh_tokens
       set revoked_at = now()
       where token_hash = $1`,
      [hash],
    );

    const userRows = await this.dataSource.query(
      `select id, is_platform_admin from public.users
       where id = $1`,
      [userId],
    );

    const user = userRows[0];

    return this.issueTokens(
      {
        sub: userId,
        isPlatformAdmin: user.is_platform_admin,
      },
      newTenantId,
      membership[0].role ?? null,
    );
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.dataSource.query(
      `update public.refresh_tokens
       set revoked_at = now()
       where token_hash = $1`,
      [hash],
    );
    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.dataSource.query(
      `update public.refresh_tokens
       set revoked_at = now()
       where user_id = $1
       and revoked_at is null`,
      [userId],
    );
    return { success: true };
  }

  private async issueTokens(
    user: UserIdentity,
    tenantId: string | null,
    role: string | null,
  ) {
    const payload: JwtPayload = {
      sub: user.sub,
      tenant_id: tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
      role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: '30d',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET!,
      expiresIn: '30d',
    });

    const hash = this.hashToken(refreshToken);

    await this.dataSource.query(
      `insert into public.refresh_tokens
       (user_id, tenant_id, token_hash, expires_at)
       values ($1, $2, $3, now() + interval '30 days')`,
      [user.sub, tenantId, hash],
    );

    return { accessToken, refreshToken, expiresIn: 2592000 }; // 30d
  }

  private async resolveRole(
    userId: string,
    tenantId: string | null,
    isPlatformAdmin: boolean,
  ): Promise<string | null> {
    if (isPlatformAdmin) return 'tenant_admin';
    if (!tenantId) return null;
    const rows = await this.dataSource.query(
      `select role from public.memberships
       where user_id = $1 and tenant_id = $2 and status = 'active'
       limit 1`,
      [userId, tenantId],
    );
    return rows[0]?.role ?? null;
  }

  // ── Driver SMS OTP ──────────────────────────────────────────────────────────

  /** Send 6-digit OTP to driver's phone number */
  /** Send 6-digit OTP to driver's email (platform Resend) */
  async sendDriverOtp(email: string): Promise<{ sent: boolean }> {
    const normalised = email.trim().toLowerCase();

    // Find driver by email
    const rows = await this.dataSource.query(
      `SELECT u.id, u.full_name, u.email
       FROM public.users u
       JOIN public.memberships m ON m.user_id = u.id AND m.role = 'driver' AND m.status = 'active'
       WHERE LOWER(u.email) = $1
       LIMIT 1`,
      [normalised],
    );

    // Always return sent:true (security)
    if (!rows.length) return { sent: true };

    const user = rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await this.dataSource.query(
      `UPDATE public.users
       SET sms_otp = $1, sms_otp_expires_at = $2
       WHERE id = $3`,
      [otp, expiresAt.toISOString(), user.id],
    );

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1A1A2E;color:#fff;border-radius:12px;">
        <p style="font-size:13px;letter-spacing:4px;color:#C8A870;margin-bottom:8px;">CHAUFFEUR SOLUTIONS</p>
        <h2 style="margin:0 0 24px;font-size:20px;">Driver Login Code</h2>
        <div style="background:#222236;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
          <p style="font-size:36px;font-weight:700;letter-spacing:12px;color:#C8A870;margin:0;">${otp}</p>
        </div>
        <p style="color:#9CA3AF;font-size:13px;">This code expires in <strong style="color:#fff;">10 minutes</strong>.</p>
        <p style="color:#9CA3AF;font-size:13px;">If you did not request this, please ignore this email.</p>
      </div>`;

    const resendKey = process.env.RESEND_API_KEY;
    const smtpPassword = process.env.SMTP_PASSWORD;

    const fromEmail = process.env.PLATFORM_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_FROM_EMAIL ?? 'noreply@chauffeurssolution.com';
    const fromName  = process.env.PLATFORM_FROM_NAME  ?? process.env.RESEND_FROM_NAME  ?? process.env.SMTP_FROM_NAME  ?? 'Chauffeur Solutions';

    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [user.email],
          subject: `${otp} — Your Driver Login Code`,
          html,
        }),
      }).catch(e => this.logger.error(`[OTP] Resend failed: ${e?.message}`));
      this.logger.log(`[OTP] Email sent via Resend to ${user.email}`);
    } else if (smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST ?? 'smtp.office365.com',
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
          auth: {
            user: process.env.SMTP_USERNAME ?? fromEmail,
            pass: smtpPassword,
          },
        });

        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: user.email,
          subject: `${otp} — Your Driver Login Code`,
          html,
        });

        this.logger.log(`[OTP] Email sent via SMTP to ${user.email}`);
      } catch (e: any) {
        this.logger.error(`[OTP] SMTP failed: ${e?.message ?? e}`);
      }
    } else {
      this.logger.warn(`[OTP] No RESEND_API_KEY/SMTP_PASSWORD — code for ${user.full_name}: ${otp}`);
    }

    return { sent: true };
  }

  /** Verify email OTP and return tokens */
  async verifyDriverOtp(email: string, otp: string) {
    const normalised = email.trim().toLowerCase();

    const rows = await this.dataSource.query(
      `SELECT u.id, u.sms_otp, u.sms_otp_expires_at, u.is_platform_admin
       FROM public.users u
       JOIN public.memberships m ON m.user_id = u.id AND m.role = 'driver' AND m.status = 'active'
       WHERE LOWER(u.email) = $1
       LIMIT 1`,
      [normalised],
    );

    if (!rows.length) throw new UnauthorizedException('Invalid code');

    const user = rows[0];
    if (!user.sms_otp || user.sms_otp !== otp.trim()) {
      throw new UnauthorizedException('Invalid code');
    }
    if (user.sms_otp_expires_at && new Date(user.sms_otp_expires_at) < new Date()) {
      throw new UnauthorizedException('Code expired');
    }

    // Clear OTP
    await this.dataSource.query(
      `UPDATE public.users SET sms_otp = NULL, sms_otp_expires_at = NULL WHERE id = $1`,
      [user.id],
    );

    const memberships = await this.dataSource.query(
      `SELECT m.tenant_id FROM public.memberships m
       WHERE m.user_id = $1 AND m.role = 'driver' AND m.status = 'active'
       LIMIT 1`,
      [user.id],
    );

    return this.issueTokens(
      { sub: user.id, isPlatformAdmin: false },
      memberships[0]?.tenant_id ?? null,
      'driver',
    );
  }
}
