import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly notificationSvc: NotificationService,
  ) {}

  /** Normalize phone: split into { code, number } removing duplicates */
  private splitPhone(countryCode: string, rawNumber: string): { code: string; number: string } {
    let num = rawNumber.trim().replace(/\s+/g, '');
    const cc = countryCode.trim();
    // Strip leading + if just digits after
    if (num.startsWith('+')) {
      const m = num.match(/^(\+\d{1,3})(\d+)$/);
      if (m) {
        // Use the embedded country code, ignore the passed-in one if different
        return { code: m[1], number: m[2] };
      }
    }
    // Strip leading 0 (Australian local format)
    num = num.replace(/^0/, '');
    // Strip country code prefix if duplicated (e.g. cc="+61", num="61415880519")
    const ccDigits = cc.replace('+', '');
    if (num.startsWith(ccDigits)) {
      num = num.slice(ccDigits.length);
    }
    return { code: cc, number: num };
  }

  // ── Register ───────────────────────────────────────────────────────────────
  async register(dto: {
    tenantSlug: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
  }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);

    // Check if email already registered
    const existing = await this.db.query(
      `SELECT id FROM public.customer_auth WHERE tenant_id = $1 AND email = $2`,
      [tenant.id, dto.email.toLowerCase()],
    );
    if (existing.length) throw new BadRequestException('Email already registered');

    const hash = await bcrypt.hash(dto.password, 12);

    // Create customer record
    const [customer] = await this.db.query(
      `INSERT INTO public.customers (tenant_id, email, first_name, last_name, phone_country_code, phone_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING id`,
      ...((): any[] => {
        const ph = dto.phoneNumber
          ? this.splitPhone(dto.phoneCountryCode ?? '+61', dto.phoneNumber)
          : { code: dto.phoneCountryCode ?? '+61', number: null };
        return [tenant.id, dto.email.toLowerCase(), dto.firstName, dto.lastName, ph.code, ph.number];
      })(),
    );

    await this.db.query(
      `INSERT INTO public.customer_auth (customer_id, tenant_id, email, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [customer.id, tenant.id, dto.email.toLowerCase(), hash],
    );

    return this.issueTokens(customer.id, tenant.id);
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: { tenantSlug: string; email: string; password: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);

    const rows = await this.db.query(
      `SELECT ca.password_hash, ca.customer_id
       FROM public.customer_auth ca
       WHERE ca.tenant_id = $1 AND ca.email = $2`,
      [tenant.id, dto.email.toLowerCase()],
    );
    console.log(`[CustomerAuth] login attempt: email=${dto.email} rows=${rows.length} hasHash=${!!rows[0]?.password_hash}`);
    if (!rows.length || !rows[0].password_hash) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, rows[0].password_hash);
    console.log(`[CustomerAuth] bcrypt compare: ${ok}`);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(rows[0].customer_id, tenant.id);
  }

  // ── OTP Send ───────────────────────────────────────────────────────────────
  async sendOtp(dto: { tenantSlug: string; phone: string; phoneCode?: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    // If phone already includes country code (starts with +), split it out
    let phoneCode: string;
    let phoneNumber: string;
    if (dto.phone.startsWith('+')) {
      // e.g. "+61415880519" → code="+61", number="415880519"
      const match = dto.phone.match(/^(\+\d{1,3})(\d+)$/);
      if (match) {
        phoneCode = match[1];
        phoneNumber = match[2];
      } else {
        phoneCode = dto.phoneCode ?? '+61';
        phoneNumber = dto.phone.replace(/^\+\d{1,3}/, '').replace(/^0/, '');
      }
    } else {
      phoneCode = dto.phoneCode ?? '+61';
      phoneNumber = dto.phone.replace(/^0/, ''); // strip leading 0 for AU numbers
    }

    // Upsert customer_auth by phone — match full number regardless of how country code is stored
    const fullPhone = `${phoneCode}${phoneNumber}`;
    const rows = await this.db.query(
      `SELECT ca.id, c.is_guest FROM public.customer_auth ca
       JOIN public.customers c ON c.id = ca.customer_id
       WHERE ca.tenant_id = $1
         AND (
           c.phone_number = $2
           OR CONCAT(c.phone_country_code, c.phone_number) = $3
           OR c.phone_number = $3
         )`,
      [tenant.id, phoneNumber, fullPhone],
    );

    if (!rows.length) {
      // Only create guest if no existing customer (guest or real) has this phone
      const existingCustomer = await this.db.query(
        `SELECT id FROM public.customers
         WHERE tenant_id = $1
           AND (phone_number = $2 OR CONCAT(phone_country_code, phone_number) = $3 OR phone_number = $3)
         LIMIT 1`,
        [tenant.id, phoneNumber, fullPhone],
      );

      let customerId: string;
      if (existingCustomer.length) {
        customerId = existingCustomer[0].id;
      } else {
        // Create guest customer for new phone number
        const [customer] = await this.db.query(
          `INSERT INTO public.customers (tenant_id, phone_country_code, phone_number, first_name, last_name, is_guest, created_at, updated_at)
           VALUES ($1, $2, $3, 'Guest', '', true, now(), now())
           RETURNING id`,
          [tenant.id, phoneCode, phoneNumber],
        );
        customerId = customer.id;
      }

      const [customer] = [{ id: customerId }];
      await this.db.query(
        `INSERT INTO public.customer_auth (customer_id, tenant_id, phone_number, otp_code, otp_expires_at, last_otp_sent_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [customer.id, tenant.id, phoneNumber, otp, expires],
      );
    } else {
      await this.db.query(
        `UPDATE public.customer_auth SET otp_code=$1, otp_expires_at=$2, last_otp_sent_at=now()
         WHERE id=$3`,
        [otp, expires, rows[0].id],
      );
    }

    // Send OTP via SMS (non-blocking — don't fail if SMS fails)
    // fullPhone already defined above
    await this.notificationSvc.handleEvent('CustomerOtp', {
      tenant_id: tenant.id,
      phone: fullPhone,
      otp,
    }).catch((e) => console.error('[OTP] SMS send failed:', e?.message));

    const isDev = process.env.NODE_ENV !== 'production';
    return { sent: true, ...(isDev ? { otp } : {}) };
  }

  // ── OTP Verify ─────────────────────────────────────────────────────────────
  async verifyOtp(dto: { tenantSlug: string; phone: string; otp: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);
    // Strip country code if present
    let phoneNumber: string;
    if (dto.phone.startsWith('+')) {
      const match = dto.phone.match(/^(\+\d{1,3})(\d+)$/);
      phoneNumber = match ? match[2] : dto.phone.replace(/^\+\d{1,3}/, '').replace(/^0/, '');
    } else {
      phoneNumber = dto.phone.replace(/^0/, '');
    }

    const rows = await this.db.query(
      `SELECT ca.customer_id, ca.otp_code, ca.otp_expires_at
       FROM public.customer_auth ca
       JOIN public.customers c ON c.id = ca.customer_id
       WHERE ca.tenant_id = $1 AND c.phone_number = $2`,
      [tenant.id, phoneNumber],
    );
    if (!rows.length) throw new UnauthorizedException('OTP not found');
    const r = rows[0];
    if (r.otp_code !== dto.otp) throw new UnauthorizedException('Invalid OTP');
    if (new Date(r.otp_expires_at) < new Date()) throw new UnauthorizedException('OTP expired');

    await this.db.query(
      `UPDATE public.customer_auth SET otp_code=null, otp_expires_at=null
       WHERE customer_id=$1`,
      [r.customer_id],
    );

    return this.issueTokens(r.customer_id, tenant.id);
  }

  // ── Forgot Password ────────────────────────────────────────────────────────
  async forgotPassword(dto: { tenantSlug: string; email: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);
    const email = dto.email.toLowerCase();

    // Look up customer_auth record
    const [auth] = await this.db.query(
      `SELECT ca.customer_id, ca.email, c.first_name, c.last_name
       FROM public.customer_auth ca
       JOIN public.customers c ON c.id = ca.customer_id
       WHERE ca.tenant_id=$1 AND ca.email=$2
       LIMIT 1`,
      [tenant.id, email],
    );

    // If no auth record, check if customer exists (guest who never registered)
    // Auto-create a customer_auth row so they can set a password via reset link
    if (!auth) {
      const [customer] = await this.db.query(
        `SELECT id, first_name, last_name FROM public.customers
         WHERE tenant_id=$1 AND email=$2 AND deleted_at IS NULL LIMIT 1`,
        [tenant.id, email],
      );
      if (!customer) return { sent: true }; // email not found — don't reveal

      // Create customer_auth with no password (they'll set it via reset link)
      await this.db.query(
        `INSERT INTO public.customer_auth (customer_id, tenant_id, email, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [customer.id, tenant.id, email],
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.db.query(
      `UPDATE public.customer_auth
       SET reset_token=$1, reset_token_expires_at=$2, updated_at=now()
       WHERE tenant_id=$3 AND email=$4`,
      [token, expires, tenant.id, email],
    );

    // Send password reset email
    const portalUrl = process.env.CUSTOMER_PORTAL_URL ?? 'https://aschauffeured.chauffeurssolution.com';
    const resetUrl = `${portalUrl}/reset-password?token=${token}`;

    await this.notificationSvc.handleEvent('CustomerForgotPassword', {
      tenant_id: tenant.id,
      email,
      name: `${auth.first_name ?? ''} ${auth.last_name ?? ''}`.trim(),
      customer_first_name: auth.first_name ?? '',
      reset_url: resetUrl,
      reset_link: resetUrl,
    }).catch(() => {});

    return { sent: true };
  }

  // ── Reset Password ─────────────────────────────────────────────────────────
  async resetPassword(dto: { token: string; password: string }) {
    const rows = await this.db.query(
      `SELECT customer_id, tenant_id FROM public.customer_auth
       WHERE reset_token=$1 AND reset_token_expires_at > now()`,
      [dto.token],
    );
    if (!rows.length) throw new BadRequestException('Invalid or expired reset token');

    const hash = await bcrypt.hash(dto.password, 12);
    await this.db.query(
      `UPDATE public.customer_auth
       SET password_hash=$1, reset_token=null, reset_token_expires_at=null, updated_at=now()
       WHERE customer_id=$2`,
      [hash, rows[0].customer_id],
    );

    return this.issueTokens(rows[0].customer_id, rows[0].tenant_id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async getTenantBySlug(slug: string) {
    const rows = await this.db.query(
      `SELECT id FROM public.tenants WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if (!rows.length) throw new BadRequestException('Tenant not found');
    return rows[0];
  }

  async issueTokens(customerId: string, tenantId: string) {
    const payload = {
      sub: customerId,
      tenant_id: tenantId,
      role: 'CUSTOMER',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: '7d',
    });
    return { accessToken, expiresIn: 604800, customerId };
  }

  // ── Email OTP Login (unauthenticated) ────────────────────────────────────
  async sendEmailOtpUnauth(dto: { tenantSlug: string; email: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // Find or create customer
    let rows = await this.db.query(
      `SELECT c.id FROM public.customers c
       JOIN public.customer_auth ca ON ca.customer_id = c.id
       WHERE c.tenant_id = $1 AND LOWER(ca.email) = LOWER($2) LIMIT 1`,
      [tenant.id, dto.email],
    );

    if (!rows.length) {
      // Guest customer
      const [c] = await this.db.query(
        `INSERT INTO public.customers (tenant_id, first_name, last_name, is_guest, created_at, updated_at)
         VALUES ($1, 'Guest', '', true, now(), now()) RETURNING id`,
        [tenant.id],
      );
      await this.db.query(
        `INSERT INTO public.customer_auth (customer_id, tenant_id, email, otp_code, otp_expires_at, last_otp_sent_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [c.id, tenant.id, dto.email, otp, expires],
      );
    } else {
      await this.db.query(
        `UPDATE public.customer_auth SET otp_code=$1, otp_expires_at=$2, last_otp_sent_at=now()
         WHERE customer_id=$3 AND tenant_id=$4`,
        [otp, expires, rows[0].id, tenant.id],
      );
    }

    // Send via CustomerEmailVerification notification
    await this.notificationSvc.handleEvent('CustomerEmailVerification', {
      tenant_id: tenant.id,
      email: dto.email,
      first_name: 'Customer',
      otp,
    }).catch((e: any) => console.error('[EmailOTP] send failed:', e?.message));

    const isDev = process.env.NODE_ENV !== 'production';
    return { sent: true, ...(isDev ? { otp } : {}) };
  }

  async verifyEmailOtpUnauth(dto: { tenantSlug: string; email: string; otp: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);

    const rows = await this.db.query(
      `SELECT ca.customer_id, ca.otp_code, ca.otp_expires_at
       FROM public.customer_auth ca
       WHERE ca.tenant_id = $1 AND LOWER(ca.email) = LOWER($2) LIMIT 1`,
      [tenant.id, dto.email],
    );
    if (!rows.length) throw new UnauthorizedException('OTP not found');
    const r = rows[0];
    if (r.otp_code !== dto.otp) throw new UnauthorizedException('Invalid OTP');
    if (new Date(r.otp_expires_at) < new Date()) throw new UnauthorizedException('OTP expired');

    await this.db.query(
      `UPDATE public.customer_auth SET otp_code=null, otp_expires_at=null WHERE customer_id=$1`,
      [r.customer_id],
    );

    return this.issueTokens(r.customer_id, tenant.id);
  }
}
