import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRoleGuard, TenantRoles } from '../common/guards/tenant-role.guard';

@UseGuards(JwtGuard, TenantRoleGuard)
@TenantRoles('tenant_admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly configService: ConfigService,
  ) {}

  private getSupabaseAdmin(): SupabaseClient {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new BadRequestException('Supabase admin credentials missing');
    }
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  @Post(':id/reset-password')
  async resetPassword(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') actorId: string,
    @Param('id') userId: string,
    @Body() body: { newPassword: string },
  ) {
    const newPassword = body?.newPassword?.trim();
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const rows = await this.db.query(
      `SELECT u.id, m.role
       FROM public.users u
       JOIN public.memberships m ON m.user_id = u.id
       WHERE u.id = $1 AND m.tenant_id = $2
       LIMIT 1`,
      [userId, tenantId],
    );
    const user = rows[0];
    if (!user) throw new BadRequestException('User not found');
    if (!['driver', 'customer'].includes(user.role)) {
      throw new ForbiddenException('Unsupported user type');
    }

    const supabase = this.getSupabaseAdmin();
    const { data: authUser, error: getError } = await supabase.auth.admin.getUserById(userId);
    if (getError || !authUser?.user) {
      throw new BadRequestException(getError?.message ?? 'Auth user not found');
    }

    const appMeta = {
      ...(authUser.user.app_metadata ?? {}),
      tenant_id: tenantId,
      role: user.role,
    };
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: appMeta,
    });
    if (updateError) throw new BadRequestException(updateError.message);

    await this.db.query(
      `INSERT INTO public.admin_password_reset_logs
         (tenant_id, actor_user_id, target_user_id, target_user_type, action_type, reset_mode, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        tenantId,
        actorId,
        userId,
        user.role,
        'reset_password',
        'admin_api',
        JSON.stringify({ source: 'admin/users/reset-password' }),
      ],
    );

    return { ok: true };
  }
}
