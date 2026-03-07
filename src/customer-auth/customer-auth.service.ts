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
      [tenant.id, dto.email.toLowerCase(), dto.firstName, dto.lastName,
       dto.phoneCountryCode ?? '+61', dto.phoneNumber ?? null],
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
    if (!rows.length) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, rows[0].password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(rows[0].customer_id, tenant.id);
  }

  // ── OTP Send ───────────────────────────────────────────────────────────────
  async sendOtp(dto: { tenantSlug: string; phone: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    // Upsert customer_auth by phone (simple approach)
    const rows = await this.db.query(
      `SELECT ca.id FROM public.customer_auth ca
       JOIN public.customers c ON c.id = ca.customer_id
       WHERE ca.tenant_id = $1 AND c.phone_number = $2`,
      [tenant.id, dto.phone],
    );

    if (!rows.length) {
      // Create guest customer
      const [customer] = await this.db.query(
        `INSERT INTO public.customers (tenant_id, phone_country_code, phone_number, first_name, last_name, is_guest, created_at, updated_at)
         VALUES ($1, '+61', $2, 'Guest', '', true, now(), now())
         RETURNING id`,
        [tenant.id, dto.phone],
      );
      await this.db.query(
        `INSERT INTO public.customer_auth (customer_id, tenant_id, phone_number, otp_code, otp_expires_at, last_otp_sent_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [customer.id, tenant.id, dto.phone, otp, expires],
      );
    } else {
      await this.db.query(
        `UPDATE public.customer_auth SET otp_code=$1, otp_expires_at=$2, last_otp_sent_at=now()
         WHERE id=$3`,
        [otp, expires, rows[0].id],
      );
    }

    // In production: send SMS. For now return otp in dev mode only.
    const isDev = process.env.NODE_ENV !== 'production';
    return { sent: true, ...(isDev ? { otp } : {}) };
  }

  // ── OTP Verify ─────────────────────────────────────────────────────────────
  async verifyOtp(dto: { tenantSlug: string; phone: string; otp: string }) {
    const tenant = await this.getTenantBySlug(dto.tenantSlug);

    const rows = await this.db.query(
      `SELECT ca.customer_id, ca.otp_code, ca.otp_expires_at
       FROM public.customer_auth ca
       JOIN public.customers c ON c.id = ca.customer_id
       WHERE ca.tenant_id = $1 AND c.phone = $2`,
      [tenant.id, dto.phone],
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

    // Look up customer_auth + customer profile
    const [auth] = await this.db.query(
      `SELECT ca.customer_id, ca.email, c.first_name, c.last_name
       FROM public.customer_auth ca
       JOIN public.customers c ON c.id = ca.customer_id
       WHERE ca.tenant_id=$1 AND ca.email=$2
       LIMIT 1`,
      [tenant.id, email],
    );

    // Always return success to prevent email enumeration
    if (!auth) return { sent: true };

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
}
