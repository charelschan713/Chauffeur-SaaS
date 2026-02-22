import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  newSupabaseAdminClient,
  supabaseAdmin,
  supabaseClient,
} from '../../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteDriverDto } from './dto/invite-driver.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterPassengerDto } from './dto/register-passenger.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Injectable()
export class AuthService {
  constructor(private readonly notificationsService: NotificationsService) {}
  // 乘客注册
  async registerPassenger(dto: RegisterPassengerDto) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });
    if (error) throw new BadRequestException(error.message);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        role: 'PASSENGER',
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: dto.phone ?? null,
        tenant_id: null,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      throw new BadRequestException(
        `Failed to create profile: ${profileError.message}`,
      );
    }

    return { message: 'Registration successful', user_id: data.user.id };
  }

  // 租户注册（同时创建租户和管理员账号）
  async registerTenant(dto: RegisterTenantDto) {
    // 检查slug是否已存在
    const { data: existing } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', dto.slug)
      .single();

    if (existing) throw new BadRequestException('Company slug already taken');

    // 创建租户
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({ name: dto.company_name, slug: dto.slug, status: 'PENDING' })
      .select()
      .single();

    if (tenantError) throw new BadRequestException(tenantError.message);

    // 创建管理员用户
    const { data: user, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

    if (userError) {
      // 回滚租户
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      throw new BadRequestException(userError.message);
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.user.id,
        role: 'TENANT_ADMIN',
        tenant_id: tenant.id,
        first_name: dto.first_name,
        last_name: dto.last_name,
      });

    if (profileError) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      await supabaseAdmin.auth.admin.deleteUser(user.user.id);
      throw new BadRequestException(
        `Failed to create tenant admin profile: ${profileError.message}`,
      );
    }

    await this.notificationsService.notifyTenantPendingApproval(tenant.id);

    return {
      message: 'Tenant registered, pending approval',
      tenant_id: tenant.id,
    };
  }

  // 登录（所有角色统一入口）
  async login(dto: LoginDto) {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) throw new UnauthorizedException('Invalid credentials');

    // 获取profile（使用全新service-role client，避免会话污染）
    const adminClient = newSupabaseAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*, tenants(name, slug, status)')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new UnauthorizedException(
        'Profile not found. Please contact support.',
      );
    }

    if (!profile.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.role,
        tenant_id: profile.tenant_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    };
  }

  // 刷新Token
  async refreshToken(refresh_token: string) {
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });
    if (error || !data.session)
      throw new UnauthorizedException('Invalid refresh token');
    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
  }

  // 租户邀请司机
  async inviteDriver(dto: InviteDriverDto, tenant_id: string) {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      dto.email,
      {
        data: { role: 'DRIVER', tenant_id },
      },
    );

    if (error) throw new BadRequestException(error.message);

    await supabaseAdmin.from('profiles').insert({
      id: data.user.id,
      role: 'DRIVER',
      tenant_id,
      first_name: dto.first_name,
      last_name: dto.last_name,
    });

    return { message: 'Driver invitation sent' };
  }

  // 登出
  async logout(access_token: string) {
    await supabaseAdmin.auth.admin.signOut(access_token);
    return { message: 'Logged out successfully' };
  }
}
