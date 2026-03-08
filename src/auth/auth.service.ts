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
import { SmsProvider } from '../notification/providers/sms.provider';
import { IntegrationResolver } from '../integration/integration.resolver';

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
    private readonly smsProvider: SmsProvider,
    private readonly integrationResolver: IntegrationResolver,
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

  async login(email: string, password: string) {
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

    const memberships = await this.dataSource.query(
      `select m.tenant_id, m.role, t.status as tenant_status
       from public.memberships m
       left join public.tenants t on t.id = m.tenant_id
       where m.user_id = $1 and m.status = 'active'
       limit 1`,
      [user.id],
    );

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
      expiresIn: '8h',
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

    return { accessToken, refreshToken, expiresIn: 28800 }; // 8h
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
  async sendDriverOtp(phone: string): Promise<{ sent: boolean }> {
    // Normalise phone: strip spaces, ensure +61 prefix for AU
    const normalised = phone.trim().replace(/\s+/g, '');

    // Find user by phone
    const rows = await this.dataSource.query(
      `SELECT u.id, u.full_name,
              u.phone_country_code || u.phone_number AS full_phone
       FROM public.users u
       JOIN public.memberships m ON m.user_id = u.id AND m.role = 'driver' AND m.status = 'active'
       WHERE REPLACE(CONCAT(u.phone_country_code, u.phone_number), ' ', '') = $1
          OR REPLACE(u.phone_number, ' ', '') = $1
       LIMIT 1`,
      [normalised],
    );

    // Always return sent:true (security — don't reveal if number exists)
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

    // Send via tenant's Twilio integration (same as booking SMS notifications)
    const smsBody = `ASChauffeured driver code: ${otp}. Expires in 10 minutes.`;
    const toPhone = (rows[0].full_phone || normalised).trim();

    try {
      const smsIntegration = await this.integrationResolver.resolve(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // aschauffeured tenant
        'twilio',
      );
      if (smsIntegration) {
        await this.smsProvider.send(smsIntegration, toPhone, smsBody);
        this.logger.log(`[OTP] SMS sent to ${toPhone}`);
      } else {
        // Dev fallback: log to console
        this.logger.warn(`[OTP] No Twilio integration — code for ${user.full_name}: ${otp}`);
      }
    } catch (e: any) {
      this.logger.error(`[OTP] SMS failed: ${e?.message}`);
    }

    return { sent: true };
  }

  /** Verify OTP and return tokens */
  async verifyDriverOtp(phone: string, otp: string) {
    const normalised = phone.trim().replace(/\s+/g, '');

    const rows = await this.dataSource.query(
      `SELECT u.id, u.sms_otp, u.sms_otp_expires_at, u.is_platform_admin
       FROM public.users u
       JOIN public.memberships m ON m.user_id = u.id AND m.role = 'driver' AND m.status = 'active'
       WHERE REPLACE(CONCAT(u.phone_country_code, u.phone_number), ' ', '') = $1
          OR REPLACE(u.phone_number, ' ', '') = $1
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

    // Resolve membership
    const memberships = await this.dataSource.query(
      `SELECT m.tenant_id, m.role
       FROM public.memberships m
       WHERE m.user_id = $1 AND m.role = 'driver' AND m.status = 'active'
       LIMIT 1`,
      [user.id],
    );

    const tenantId = memberships[0]?.tenant_id ?? null;
    return this.issueTokens(
      { sub: user.id, isPlatformAdmin: false },
      tenantId,
      'driver',
    );
  }
}
