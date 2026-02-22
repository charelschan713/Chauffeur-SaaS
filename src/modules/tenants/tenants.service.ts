import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly notificationsService: NotificationsService) {}
  // SUPER_ADMIN：获取所有租户列表
  async findAll(status?: string) {
    let query = supabaseAdmin
      .from('tenants')
      .select('*, profiles(id, first_name, last_name, email:id)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 根据域名查找租户（公开接口，不需要Auth）
  async findByDomain(domain: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, logo_url, domain, status')
      .eq('domain', domain)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !data) throw new NotFoundException('Tenant not found');
    return data;
  }

  // 根据slug查找租户（公开接口）
  async findBySlug(slug: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, logo_url, domain, status')
      .eq('slug', slug)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !data) throw new NotFoundException('Tenant not found');
    return data;
  }

  // 获取单个租户
  async findOne(id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Tenant not found');
    return data;
  }

  // TENANT_ADMIN：更新自己的租户信息
  async update(id: string, dto: UpdateTenantDto, requestingTenantId: string) {
    if (id !== requestingTenantId) {
      throw new ForbiddenException('Cannot update another tenant');
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // SUPER_ADMIN：审核租户（PENDING → ACTIVE 或 SUSPENDED）
  async updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    if (status === 'ACTIVE') {
      await this.notificationsService.notifyTenantApproved(id);
    }

    return data;
  }

  // 租户仪表板统计
  async getDashboard(tenant_id: string) {
    const [bookings, drivers, revenue] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('status', { count: 'exact' })
        .eq('tenant_id', tenant_id),
      supabaseAdmin
        .from('drivers')
        .select('status', { count: 'exact' })
        .eq('tenant_id', tenant_id),
      supabaseAdmin
        .from('payments')
        .select('tenant_payout')
        .eq('tenant_id', tenant_id)
        .eq('status', 'CAPTURED'),
    ]);

    const totalRevenue =
      revenue.data?.reduce((sum, p) => sum + (p.tenant_payout || 0), 0) ?? 0;

    return {
      bookings: {
        total: bookings.count ?? 0,
        by_status: bookings.data,
      },
      drivers: {
        total: drivers.count ?? 0,
        by_status: drivers.data,
      },
      total_revenue: totalRevenue,
    };
  }

  // ── 定价规则 ──

  // 获取租户定价规则
  async getPricingRules(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 创建定价规则
  async createPricingRule(tenant_id: string, dto: CreatePricingRuleDto) {
    // 同一租户同一车型只能有一条active规则
    await supabaseAdmin
      .from('pricing_rules')
      .update({ is_active: false })
      .eq('tenant_id', tenant_id)
      .eq('vehicle_class', dto.vehicle_class);

    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 删除定价规则
  async deletePricingRule(rule_id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('pricing_rules')
      .update({ is_active: false })
      .eq('id', rule_id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Pricing rule deleted' };
  }

  // 价格估算（乘客预约前调用）
  async estimatePrice(
    tenant_id: string,
    vehicle_class: string,
    distance_km: number,
    duration_minutes: number,
  ) {
    const { data: rule } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('vehicle_class', vehicle_class)
      .eq('is_active', true)
      .single();

    if (!rule)
      throw new NotFoundException(
        'No pricing rule found for this vehicle class',
      );

    const calculated =
      rule.base_fare +
      rule.price_per_km * distance_km +
      rule.price_per_minute * duration_minutes;

    const total = Math.max(calculated, rule.minimum_fare);

    return {
      vehicle_class,
      distance_km,
      duration_minutes,
      base_fare: rule.base_fare,
      calculated_price: parseFloat(total.toFixed(2)),
      currency: rule.currency,
    };
  }
}
