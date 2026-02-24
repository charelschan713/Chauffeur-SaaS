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
      .eq('vehicle_type_id', dto.vehicle_type_id);

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

  // 更新集成配置（Stripe/Resend/Twilio）
  async updateIntegrations(tenant_id: string, dto: any) {
    const updateData: any = {};

    const fields = [
      'resend_api_key',
      'resend_from_email',
      'twilio_account_sid',
      'twilio_auth_token',
      'twilio_from_number',
      'stripe_publishable_key',
      'stripe_webhook_secret',
    ];

    fields.forEach((field) => {
      if (dto[field] !== undefined && dto[field] !== '') {
        updateData[field] = dto[field];
      }
    });

    if (dto.stripe_secret_key && dto.stripe_secret_key !== '') {
      updateData.stripe_secret_key = this.encrypt(dto.stripe_secret_key);
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const { stripe_secret_key, ...safe } = data as any;
    return safe;
  }

  // 价格估算（乘客预约前调用）
  async estimatePrice(
    tenant_id: string,
    vehicle_type_id: string,
    service_type: string,
    distance_km?: number,
    duration_hours?: number,
    duration_minutes?: number,
  ) {
    const { data: vtype, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('*')
      .eq('id', vehicle_type_id)
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .single();

    if (error || !vtype) {
      throw new BadRequestException('Vehicle type not found or inactive');
    }

    const safe_distance_km = distance_km ?? 0;
    const safe_duration_hours = duration_hours ?? 0;
    const safe_duration_minutes =
      duration_minutes ?? Math.round(safe_duration_hours * 60);

    if (
      service_type === 'POINT_TO_POINT' ||
      service_type === 'AIRPORT_PICKUP' ||
      service_type === 'AIRPORT_DROPOFF'
    ) {
      const km_fare =
        (vtype.per_km_rate ?? 0) > 0
          ? (vtype.base_fare ?? 0) + safe_distance_km * (vtype.per_km_rate ?? 0)
          : null;

      const dt_fare =
        (vtype.per_minute_rate ?? 0) > 0
          ? (vtype.base_fare ?? 0) +
            safe_duration_minutes * (vtype.per_minute_rate ?? 0)
          : null;

      const estimated_fare =
        km_fare && dt_fare ? Math.min(km_fare, dt_fare) : (km_fare ?? dt_fare ?? 0);

      const billing_options = [
        ...(km_fare
          ? [
              {
                method: 'KM',
                fare: parseFloat(km_fare.toFixed(2)),
                label: `${safe_distance_km}km × $${vtype.per_km_rate}/km`,
              },
            ]
          : []),
        ...(dt_fare
          ? [
              {
                method: 'DT',
                fare: parseFloat(dt_fare.toFixed(2)),
                label: `${safe_duration_minutes}min × $${vtype.per_minute_rate}/min`,
              },
            ]
          : []),
      ];

      return {
        vehicle_type_id: vtype.id,
        type_name: vtype.type_name,
        km_fare: km_fare ? parseFloat(km_fare.toFixed(2)) : null,
        dt_fare: dt_fare ? parseFloat(dt_fare.toFixed(2)) : null,
        estimated_fare: parseFloat(estimated_fare.toFixed(2)),
        billing_options,
        currency: vtype.currency,
        max_luggage: vtype.max_luggage,
      };
    }

    if (service_type === 'HOURLY_CHARTER') {
      const base_fare = safe_duration_hours * (vtype.hourly_rate ?? 0);

      let extra_km_charge = 0;
      if (
        (vtype.hourly_included_km ?? 0) > 0 &&
        (vtype.extra_km_rate ?? 0) > 0 &&
        safe_distance_km > 0
      ) {
        const included_km = safe_duration_hours * (vtype.hourly_included_km ?? 0);
        const extra_km = Math.max(0, safe_distance_km - included_km);
        extra_km_charge = extra_km * (vtype.extra_km_rate ?? 0);
      }

      const total = base_fare + extra_km_charge;

      return {
        vehicle_type_id: vtype.id,
        type_name: vtype.type_name,
        estimated_fare: parseFloat(total.toFixed(2)),
        billing_options: [
          {
            method: 'HOURLY',
            fare: parseFloat(total.toFixed(2)),
            label: `${safe_duration_hours}hr × $${vtype.hourly_rate}/hr${
              extra_km_charge > 0
                ? ` + $${extra_km_charge.toFixed(2)} extra km`
                : ''
            }`,
          },
        ],
        currency: vtype.currency,
        max_luggage: vtype.max_luggage,
      };
    }

    throw new BadRequestException('Unsupported service type');
  }

  private encrypt(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64');
  }
}
