import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  private hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token + process.env.JWT_REFRESH_SECRET!)
      .digest('hex');
  }

  async login(email: string, password: string) {
    const rows = await this.dataSource.query(
      `select id, is_platform_admin from public.users
       where email = $1`,
      [email],
    );
    if (!rows.length)
      throw new UnauthorizedException('Invalid credentials');

    const user = rows[0];

    const memberships = await this.dataSource.query(
      `select tenant_id from public.memberships
       where user_id = $1 and status = 'active'
       limit 1`,
      [user.id],
    );

    const tenantId = memberships[0]?.tenant_id ?? null;

    return this.issueTokens(
      {
        sub: user.id,
        isPlatformAdmin: user.is_platform_admin,
      },
      tenantId,
    );
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

    const user = await this.dataSource.query(
      `select id, is_platform_admin from public.users
       where id = $1`,
      [stored.user_id],
    );

    return this.issueTokens(
      {
        sub: stored.user_id,
        isPlatformAdmin: user[0].is_platform_admin,
      },
      stored.tenant_id,
    );
  }

  async switchTenant(
    userId: string,
    newTenantId: string,
    currentRefreshToken: string,
  ) {
    const membership = await this.dataSource.query(
      `select status from public.memberships
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

    const user = await this.dataSource.query(
      `select id, is_platform_admin from public.users
       where id = $1`,
      [userId],
    );

    return this.issueTokens(
      {
        sub: userId,
        isPlatformAdmin: user[0].is_platform_admin,
      },
      newTenantId,
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
    user: { sub: string; isPlatformAdmin: boolean },
    tenantId: string | null,
  ) {
    const payload = {
      sub: user.sub,
      tenant_id: tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: '15m',
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

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
