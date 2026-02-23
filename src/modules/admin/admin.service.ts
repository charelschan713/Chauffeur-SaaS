import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';

@Injectable()
export class AdminService {
  // 创建第一个SuperAdmin（需要密钥验证）
  async createSuperAdmin(dto: CreateSuperAdminDto) {
    if (dto.super_admin_secret !== process.env.SUPER_ADMIN_SECRET) {
      throw new ForbiddenException('Invalid super admin secret');
    }

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
        role: 'SUPER_ADMIN',
        first_name: dto.first_name,
        last_name: dto.last_name,
        tenant_id: null,
      });

    if (profileError) throw new BadRequestException(profileError.message);

    return { message: 'Super admin created', user_id: data.user.id };
  }

  // 平台总览仪表板
  async getPlatformDashboard() {
    const [tenants, users, bookings, revenue] = await Promise.all([
      supabaseAdmin.from('tenants').select('status', { count: 'exact' }),
      supabaseAdmin.from('profiles').select('role', { count: 'exact' }),
      supabaseAdmin.from('bookings').select('status', { count: 'exact' }),
      supabaseAdmin
        .from('payments')
        .select('platform_fee, tenant_payout, amount')
        .eq('status', 'CAPTURED'),
    ]);

    const totalPlatformFee =
      revenue.data?.reduce((s, p) => s + (p.platform_fee ?? 0), 0) ?? 0;
    const totalGMV = revenue.data?.reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0;

    // 按状态分组统计
    const tenantsByStatus = this.groupBy(tenants.data ?? [], 'status');
    const bookingsByStatus = this.groupBy(bookings.data ?? [], 'status');

    return {
      tenants: {
        total: tenants.count ?? 0,
        by_status: tenantsByStatus,
      },
      users: {
        total: users.count ?? 0,
      },
      bookings: {
        total: bookings.count ?? 0,
        by_status: bookingsByStatus,
      },
      revenue: {
        total_gmv: parseFloat(totalGMV.toFixed(2)),
        total_platform_fee: parseFloat(totalPlatformFee.toFixed(2)),
        total_transactions: revenue.data?.length ?? 0,
      },
    };
  }

  // 所有租户列表（含统计）
  async getAllTenants(status?: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('tenants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    return {
      data,
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  // 审核租户
  async approveTenant(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({ status: 'ACTIVE' })
      .eq('id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Tenant not found');
    return data;
  }

  async suspendTenant(tenant_id: string, reason?: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({ status: 'SUSPENDED' })
      .eq('id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Tenant not found');
    return data;
  }

  // 单个租户详情（含司机/订单/收入统计）
  async getTenantDetail(tenant_id: string) {
    const [tenant, drivers, bookings, revenue] = await Promise.all([
      supabaseAdmin.from('tenants').select('*').eq('id', tenant_id).single(),
      supabaseAdmin
        .from('drivers')
        .select('status', { count: 'exact' })
        .eq('tenant_id', tenant_id),
      supabaseAdmin
        .from('bookings')
        .select('status', { count: 'exact' })
        .eq('tenant_id', tenant_id),
      supabaseAdmin
        .from('payments')
        .select('amount, platform_fee, tenant_payout')
        .eq('tenant_id', tenant_id)
        .eq('status', 'CAPTURED'),
    ]);

    if (!tenant.data) throw new NotFoundException('Tenant not found');

    const totalRevenue = revenue.data?.reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0;
    const platformFee =
      revenue.data?.reduce((s, p) => s + (p.platform_fee ?? 0), 0) ?? 0;

    return {
      tenant: tenant.data,
      stats: {
        drivers: {
          total: drivers.count ?? 0,
          by_status: this.groupBy(drivers.data ?? [], 'status'),
        },
        bookings: {
          total: bookings.count ?? 0,
          by_status: this.groupBy(bookings.data ?? [], 'status'),
        },
        revenue: {
          total_gmv: parseFloat(totalRevenue.toFixed(2)),
          platform_fee: parseFloat(platformFee.toFixed(2)),
        },
      },
    };
  }

  // 平台收入报表（按月）
  async getRevenueReport(year: number) {
    const start = `${year}-01-01T00:00:00Z`;
    const end = `${year}-12-31T23:59:59Z`;

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('amount, platform_fee, tenant_payout, paid_at, currency')
      .eq('status', 'CAPTURED')
      .gte('paid_at', start)
      .lte('paid_at', end)
      .order('paid_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    // 按月分组
    const monthly: Record<string, { gmv: number; platform_fee: number; transactions: number }> =
      {};

    for (let m = 1; m <= 12; m++) {
      const key = String(m).padStart(2, '0');
      monthly[key] = { gmv: 0, platform_fee: 0, transactions: 0 };
    }

    data?.forEach((p) => {
      const month = new Date(p.paid_at).toISOString().slice(5, 7);
      monthly[month].gmv += p.amount ?? 0;
      monthly[month].platform_fee += p.platform_fee ?? 0;
      monthly[month].transactions += 1;
    });

    const formatted = Object.entries(monthly).map(([month, stats]) => ({
      month: `${year}-${month}`,
      gmv: parseFloat(stats.gmv.toFixed(2)),
      platform_fee: parseFloat(stats.platform_fee.toFixed(2)),
      transactions: stats.transactions,
    }));

    const totals = {
      annual_gmv: parseFloat(formatted.reduce((s, m) => s + m.gmv, 0).toFixed(2)),
      annual_platform_fee: parseFloat(
        formatted.reduce((s, m) => s + m.platform_fee, 0).toFixed(2),
      ),
      annual_transactions: formatted.reduce((s, m) => s + m.transactions, 0),
    };

    return { year, monthly: formatted, totals };
  }

  // 平台统计
  async getPlatformStats() {
    const { count: total_tenants } = await supabaseAdmin
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    const { count: total_bookings } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    const { count: total_drivers } = await supabaseAdmin
      .from('drivers')
      .select('*', { count: 'exact', head: true });

    return {
      total_tenants: total_tenants ?? 0,
      total_bookings: total_bookings ?? 0,
      total_drivers: total_drivers ?? 0,
    };
  }

  // 重新激活租户
  async reactivateTenant(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({
        tenant_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 拒绝租户
  async declineTenant(tenant_id: string, note?: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({
        tenant_status: 'DECLINED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 所有用户列表
  async getAllUsers(role?: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('*, tenants(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role) query = query.eq('role', role);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    return {
      data,
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  // 停用/启用用户
  async toggleUserActive(user_id: string, is_active: boolean) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active })
      .eq('id', user_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('User not found');

    if (!is_active) {
      await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: 'none',
      });
    }

    return data;
  }

  // Supabase配置诊断（不返回完整密钥）
  supabaseConfigDiag(secret: string) {
    if (secret !== process.env.SUPER_ADMIN_SECRET) {
      throw new ForbiddenException('Invalid super admin secret');
    }

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const hasNewline = /\r|\n/.test(key);
    const hasSpaces = /^\s|\s$/.test(key);

    let jwtRole: string | null = null;
    let jwtRef: string | null = null;
    let jwtDecodeError: string | null = null;

    try {
      if (key.startsWith('eyJ')) {
        const payload = key.split('.')[1];
        const decoded = JSON.parse(
          Buffer.from(payload, 'base64url').toString('utf8'),
        );
        jwtRole = decoded.role ?? null;
        jwtRef = decoded.ref ?? null;
      }
    } catch (e: any) {
      jwtDecodeError = e?.message ?? 'decode failed';
    }

    return {
      url: process.env.SUPABASE_URL,
      key_prefix: key.slice(0, 16),
      key_suffix: key.slice(-8),
      key_length: key.length,
      has_newline: hasNewline,
      has_edge_spaces: hasSpaces,
      jwt_role: jwtRole,
      jwt_ref: jwtRef,
      jwt_decode_error: jwtDecodeError,
    };
  }

  // 系统健康检查
  async healthCheck() {
    const checks = await Promise.allSettled([
      supabaseAdmin.from('tenants').select('id').limit(1),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
    };
  }

  // 工具：按key分组计数
  private groupBy(arr: any[], key: string): Record<string, number> {
    return arr.reduce((acc, item) => {
      const val = item[key] ?? 'unknown';
      acc[val] = (acc[val] ?? 0) + 1;
      return acc;
    }, {});
  }
}
