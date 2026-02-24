import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class PricingService {
  // =====================
  // 获取报价
  // =====================
  async getQuote(tenant_id: string, dto: {
    service_city_id: string;
    service_type: 'POINT_TO_POINT' | 'HOURLY_CHARTER';
    vehicle_type_id: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat?: number;
    dropoff_lng?: number;
    pickup_datetime: string;
    duration_hours?: number;
    promo_code?: string;
    passenger_id?: string;
  }) {
    const { data: rules, error } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('service_type', dto.service_type)
      .eq('is_active', true);

    if (error) throw new BadRequestException(error.message);
    if (!rules || rules.length === 0) {
      throw new NotFoundException('No pricing rules found');
    }

    const { data: serviceCity } = await supabaseAdmin
      .from('tenant_service_cities')
      .select('*')
      .eq('id', dto.service_city_id)
      .single();

    if (!serviceCity) throw new NotFoundException('Service city not found');

    let distance_km = 0;
    let duration_minutes = 0;

    if (dto.service_type === 'POINT_TO_POINT') {
      if (!dto.dropoff_lat || !dto.dropoff_lng) {
        throw new BadRequestException(
          'dropoff coordinates required for POINT_TO_POINT'
        );
      }
      distance_km = this.calcDistance(
        dto.pickup_lat, dto.pickup_lng,
        dto.dropoff_lat, dto.dropoff_lng
      );
      duration_minutes = Math.round(distance_km * 1.5);
    }

    let membership_discount = null;
    if (dto.passenger_id) {
      membership_discount = await this.getMembershipDiscount(
        tenant_id, dto.passenger_id
      );
    }

    let promo = null;
    if (dto.promo_code) {
      promo = await this.validatePromoCode(tenant_id, dto.promo_code, 0);
    }

    const quotes = await Promise.all(
      rules.map(async (rule) => {
        let fare = 0;

        if (dto.service_type === 'POINT_TO_POINT') {
          fare = rule.base_fare
            + rule.price_per_km * distance_km
            + rule.price_per_minute * duration_minutes;
          fare = Math.max(fare, rule.minimum_fare);
        } else if (dto.service_type === 'HOURLY_CHARTER') {
          const hours = Math.max(
            dto.duration_hours ?? 1,
            rule.minimum_hours ?? 1
          );
          fare = rule.hourly_rate * hours;
          fare = Math.max(fare, rule.minimum_fare);
        }

        const { surcharge_amount, surcharge_percentage } =
          this.calculateSurcharge(
            fare, dto.pickup_datetime, rule.surcharge_rules ?? []
          );

        let discount_amount = 0;
        let discount_type = null;
        let discount_label = null;

        if (promo) {
          const base = promo.applies_to === 'FARE_ONLY'
            ? fare : fare + surcharge_amount;
          discount_amount = promo.discount_type === 'PERCENTAGE'
            ? base * promo.discount_value / 100
            : promo.discount_value;
          discount_type = 'PROMO';
          discount_label = `Promo: ${dto.promo_code}`;
        } else if (membership_discount) {
          const base = membership_discount.applies_to === 'FARE_ONLY'
            ? fare : fare + surcharge_amount;
          discount_amount = membership_discount.discount_type === 'PERCENTAGE'
            ? base * membership_discount.discount_value / 100
            : membership_discount.discount_value;
          discount_type = 'MEMBERSHIP';
          discount_label = `Member: ${membership_discount.name}`;
        }

        const subtotal = fare + surcharge_amount;
        const total_price = parseFloat(
          Math.max(0, subtotal - discount_amount).toFixed(2)
        );

        return {
          vehicle_type_id: rule.vehicle_type_id,
          service_type: dto.service_type,
          currency: serviceCity.currency,
          distance_km: parseFloat(distance_km.toFixed(2)),
          duration_minutes,
          fare: parseFloat(fare.toFixed(2)),
          surcharge_amount: parseFloat(surcharge_amount.toFixed(2)),
          surcharge_percentage: parseFloat(surcharge_percentage.toFixed(2)),
          surcharge_breakdown: this.getSurchargeBreakdown(
            fare, dto.pickup_datetime, rule.surcharge_rules ?? []
          ),
          discount_type,
          discount_label,
          discount_amount: parseFloat(discount_amount.toFixed(2)),
          subtotal: parseFloat(subtotal.toFixed(2)),
          total_price,
          ...(dto.service_type === 'HOURLY_CHARTER' && {
            duration_hours: dto.duration_hours,
            minimum_hours: rule.minimum_hours,
            hourly_rate: rule.hourly_rate,
            hourly_included_km: rule.hourly_included_km,
            extra_km_rate: rule.extra_km_rate,
          }),
        };
      })
    );

    return {
      service_city: {
        city_name: serviceCity.city_name,
        timezone: serviceCity.timezone,
        currency: serviceCity.currency,
      },
      quotes: quotes.sort((a, b) => a.total_price - b.total_price),
    };
  }

  // =====================
  // 定价规则 CRUD
  // =====================
  async getPricingRules(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('vehicle_type_id')
      .order('service_type');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createPricingRule(tenant_id: string, dto: {
    vehicle_type_id: string;
    service_type: 'POINT_TO_POINT' | 'HOURLY_CHARTER';
    service_city_id?: string;
    base_fare?: number;
    price_per_km?: number;
    price_per_minute?: number;
    minimum_fare?: number;
    hourly_rate?: number;
    minimum_hours?: number;
    hourly_included_km?: number;
    extra_km_rate?: number;
    surcharge_rules?: any[];
    currency?: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .insert({
        tenant_id,
        vehicle_type_id: dto.vehicle_type_id,
        service_type: dto.service_type,
        service_city_id: dto.service_city_id ?? null,
        base_fare: dto.base_fare ?? 0,
        price_per_km: dto.price_per_km ?? 0,
        price_per_minute: dto.price_per_minute ?? 0,
        minimum_fare: dto.minimum_fare ?? 0,
        hourly_rate: dto.hourly_rate ?? 0,
        minimum_hours: dto.minimum_hours ?? 1,
        hourly_included_km: dto.hourly_included_km ?? null,
        extra_km_rate: dto.extra_km_rate ?? 0,
        surcharge_rules: dto.surcharge_rules ?? [],
        currency: dto.currency ?? 'AUD',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updatePricingRule(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Pricing rule not found');
    return data;
  }

  async deletePricingRule(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Pricing rule not found');
    return { message: 'Pricing rule deactivated' };
  }

  // =====================
  // 取消政策 CRUD
  // =====================
  async getCancellationPolicies(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_cancellation_policies')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createCancellationPolicy(tenant_id: string, dto: {
    name: string;
    is_default?: boolean;
    tiers: Array<{ hours_before: number; charge_percentage: number }>;
  }) {
    if (!dto.tiers || dto.tiers.length === 0) {
      throw new BadRequestException('At least one tier required');
    }

    for (const tier of dto.tiers) {
      if (tier.charge_percentage < 0 || tier.charge_percentage > 100) {
        throw new BadRequestException(
          'charge_percentage must be between 0 and 100'
        );
      }
    }

    if (dto.is_default) {
      await supabaseAdmin
        .from('tenant_cancellation_policies')
        .update({ is_default: false })
        .eq('tenant_id', tenant_id);
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_cancellation_policies')
      .insert({
        tenant_id,
        name: dto.name,
        is_default: dto.is_default ?? false,
        tiers: dto.tiers.sort((a, b) => b.hours_before - a.hours_before),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCancellationPolicy(id: string, tenant_id: string, dto: any) {
    if (dto.is_default) {
      await supabaseAdmin
        .from('tenant_cancellation_policies')
        .update({ is_default: false })
        .eq('tenant_id', tenant_id);
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_cancellation_policies')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Cancellation policy not found');
    }
    return data;
  }

  async deleteCancellationPolicy(id: string, tenant_id: string) {
    await supabaseAdmin
      .from('tenant_cancellation_policies')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    return { message: 'Cancellation policy deleted' };
  }

  // =====================
  // Promo Code CRUD
  // =====================
  async getPromoCodes(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createPromoCode(tenant_id: string, dto: {
    code: string;
    discount_type: 'PERCENTAGE' | 'FIXED';
    discount_value: number;
    applies_to: 'FARE_ONLY' | 'TOTAL';
    min_order_amount?: number;
    max_uses?: number;
    valid_from?: string;
    valid_until?: string;
    applicable_vehicle_type_ides?: string[];
  }) {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        tenant_id,
        code: dto.code.toUpperCase(),
        discount_type: dto.discount_type,
        discount_value: dto.discount_value,
        applies_to: dto.applies_to,
        min_order_amount: dto.min_order_amount ?? 0,
        max_uses: dto.max_uses ?? null,
        valid_from: dto.valid_from ?? null,
        valid_until: dto.valid_until ?? null,
        applicable_vehicle_type_ides: dto.applicable_vehicle_type_ides ?? [],
        is_active: true,
        used_count: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Promo code already exists');
      }
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async deactivatePromoCode(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Promo code not found');
    return data;
  }

  async validatePromoCode(tenant_id: string, code: string, fare: number) {
    const { data } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!data) return null;

    const now = new Date();
    if (data.valid_from && new Date(data.valid_from) > now) return null;
    if (data.valid_until && new Date(data.valid_until) < now) return null;
    if (data.max_uses && data.used_count >= data.max_uses) return null;
    if (data.min_order_amount && fare < data.min_order_amount) return null;

    return data;
  }

  // =====================
  // 会员等级 CRUD
  // =====================
  async getMembershipTiers(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createMembershipTier(tenant_id: string, dto: {
    name: string;
    min_spend: number;
    discount_type: 'PERCENTAGE' | 'FIXED';
    discount_value: number;
    applies_to: 'FARE_ONLY' | 'TOTAL';
    sort_order?: number;
  }) {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .insert({ tenant_id, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // =====================
  // 辅助方法
  // =====================
  calculateSurcharge(
    fare: number,
    pickup_datetime: string,
    surcharge_rules: any[]
  ): { surcharge_amount: number; surcharge_percentage: number } {
    if (!surcharge_rules || surcharge_rules.length === 0) {
      return { surcharge_amount: 0, surcharge_percentage: 0 };
    }

    const pickupDate = new Date(pickup_datetime);
    const dayOfWeek = ['SUN','MON','TUE','WED','THU','FRI','SAT'][
      pickupDate.getDay()
    ];
    const timeStr = pickupDate.toTimeString().slice(0, 5);
    const dateStr = pickupDate.toISOString().slice(0, 10);

    let total_percentage = 0;

    for (const rule of surcharge_rules) {
      let applies = false;

      if (rule.type === 'TIME_RANGE') {
        const inDay = rule.days?.includes(dayOfWeek);
        const inTime = timeStr >= rule.start_time && timeStr <= rule.end_time;
        applies = inDay && inTime;
      } else if (rule.type === 'DAY_TYPE') {
        applies = rule.days?.includes(dayOfWeek);
      } else if (rule.type === 'SPECIAL_DATE') {
        applies = rule.dates?.includes(dateStr);
      }

      if (applies) {
        total_percentage += rule.surcharge_value ?? 0;
      }
    }

    const surcharge_amount = parseFloat(
      (fare * total_percentage / 100).toFixed(2)
    );

    return { surcharge_amount, surcharge_percentage: total_percentage };
  }

  private getSurchargeBreakdown(
    fare: number,
    pickup_datetime: string,
    surcharge_rules: any[]
  ) {
    if (!surcharge_rules || surcharge_rules.length === 0) return [];

    const pickupDate = new Date(pickup_datetime);
    const dayOfWeek = ['SUN','MON','TUE','WED','THU','FRI','SAT'][
      pickupDate.getDay()
    ];
    const timeStr = pickupDate.toTimeString().slice(0, 5);
    const dateStr = pickupDate.toISOString().slice(0, 10);

    const breakdown = [];

    for (const rule of surcharge_rules) {
      let applies = false;

      if (rule.type === 'TIME_RANGE') {
        applies = rule.days?.includes(dayOfWeek)
          && timeStr >= rule.start_time
          && timeStr <= rule.end_time;
      } else if (rule.type === 'DAY_TYPE') {
        applies = rule.days?.includes(dayOfWeek);
      } else if (rule.type === 'SPECIAL_DATE') {
        applies = rule.dates?.includes(dateStr);
      }

      if (applies) {
        breakdown.push({
          name: rule.name,
          percentage: rule.surcharge_value,
          amount: parseFloat(
            (fare * rule.surcharge_value / 100).toFixed(2)
          ),
        });
      }
    }

    return breakdown;
  }

  private async getMembershipDiscount(
    tenant_id: string,
    passenger_id: string
  ) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('membership_tier_id, total_spend')
      .eq('id', passenger_id)
      .single();

    if (!profile?.membership_tier_id) return null;

    const { data: tier } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .eq('id', profile.membership_tier_id)
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .single();

    return tier;
  }

  private calcDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
