import { Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class QuoteCalculatorService {

  private calculateBaseFare(
    vt: any,
    service_type: string,
    distance_km: number,
    duration_minutes: number,
    duration_hours: number,
    waypoint_count: number,
  ): number {
    let fare = 0;

    if (service_type === 'HOURLY_CHARTER') {
      const hours = Math.max(duration_hours, vt.min_booking_hours ?? 1);
      fare = (vt.hourly_rate ?? vt.base_fare ?? 0) * hours;

      const includedKmPerHour = vt.hourly_included_km ?? 0;
      if (includedKmPerHour > 0 && (vt.extra_km_rate ?? 0) > 0 && distance_km > 0) {
        const included_km = hours * includedKmPerHour;
        const extra_km = Math.max(0, distance_km - included_km);
        fare += extra_km * (vt.extra_km_rate ?? 0);
      }
    } else if (vt.pricing_model === 'INCLUDED') {
      const included_km = vt.included_km ?? 10;
      const included_min = vt.included_minutes ?? 30;

      const extra_km = Math.max(0, distance_km - included_km);
      const extra_min = Math.max(0, duration_minutes - included_min);

      fare =
        (vt.base_fare ?? 0) +
        extra_km * (vt.extra_km_rate ?? 0) +
        extra_min * (vt.extra_minute_rate ?? 0);
    } else {
      if ((vt.billing_method ?? 'KM') === 'KM') {
        fare = (vt.base_fare ?? 0) + distance_km * (vt.per_km_rate ?? 0);
      } else {
        fare = (vt.base_fare ?? 0) + duration_minutes * (vt.per_minute_rate ?? 0);
      }
    }

    if (waypoint_count > 0) {
      if ((vt.waypoint_fee_type ?? 'FIXED') === 'PERCENTAGE') {
        fare += waypoint_count * (vt.base_fare ?? 0) * ((vt.waypoint_fee ?? 0) / 100);
      } else {
        fare += waypoint_count * (vt.waypoint_fee ?? 0);
      }
    }

    return Math.max(fare, vt.minimum_fare ?? 0);
  }

  async calculate(params: {
    tenant_id: string;
    service_type: string;
    service_city_id?: string;
    pickup_datetime?: string;
    distance_km: number;
    duration_hours: number;
    duration_minutes: number;
    waypoint_count?: number;
    baby_seat_infant?: number;
    baby_seat_convertible?: number;
    baby_seat_booster?: number;
    promo_code?: string;
    contact_id?: string;
    toll_cost?: number;
  }) {
    const {
      tenant_id,
      service_type,
      pickup_datetime,
      distance_km,
      duration_hours,
      duration_minutes,
      waypoint_count = 0,
      baby_seat_infant = 0,
      baby_seat_convertible = 0,
      baby_seat_booster = 0,
      promo_code,
      contact_id,
      toll_cost = 0,
    } = params;

    const { data: vehicleTypes } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!vehicleTypes?.length) return [];

    const surgeMultiplier = await this.getSurgeMultiplier(
      tenant_id,
      service_type,
      params.service_city_id,
    );

    const timeSurcharge = pickup_datetime
      ? await this.getTimeSurcharge(tenant_id, pickup_datetime)
      : null;

    const holidaySurcharge = pickup_datetime
      ? await this.getHolidaySurcharge(tenant_id, pickup_datetime)
      : null;

    const serviceTypeSurcharge = await this.getServiceTypeSurcharge(
      tenant_id,
      service_type,
    );

    const contactDiscount = contact_id
      ? await this.getContactDiscount(contact_id, service_type, tenant_id)
      : 0;

    const promoDiscount = promo_code
      ? await this.validatePromoCode(tenant_id, promo_code)
      : null;

    const vehicleTypeIds = vehicleTypes.map((vt: any) => vt.id);
    const { data: allExtras } = await supabaseAdmin
      .from('vehicle_type_extras')
      .select('*')
      .in('tenant_vehicle_type_id', vehicleTypeIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    return vehicleTypes.map((vt: any) => {
      const billing_options: any[] = [];

      const effectiveServiceType =
        serviceTypeSurcharge?.base_type === 'HOURLY_CHARTER'
          ? 'HOURLY_CHARTER'
          : service_type;

      if ((vt.billing_method ?? 'KM') === 'KM' && vt.per_km_rate > 0 && distance_km > 0) {
        billing_options.push({
          method: 'KM',
          fare: parseFloat((((vt.base_fare ?? 0) + distance_km * vt.per_km_rate)).toFixed(2)),
          label: `${distance_km}km × $${vt.per_km_rate}/km`,
        });
      }

      if ((vt.billing_method ?? 'KM') === 'DT' && vt.per_minute_rate > 0 && duration_minutes > 0) {
        billing_options.push({
          method: 'DT',
          fare: parseFloat((((vt.base_fare ?? 0) + duration_minutes * vt.per_minute_rate)).toFixed(2)),
          label: `${duration_minutes}min × $${vt.per_minute_rate}/min`,
        });
      }

      const baseFare = this.calculateBaseFare(
        vt,
        effectiveServiceType,
        distance_km,
        duration_minutes,
        duration_hours,
        waypoint_count,
      );

      const waypointFee = waypoint_count > 0
        ? (vt.waypoint_fee_type ?? 'FIXED') === 'PERCENTAGE'
          ? waypoint_count * (vt.base_fare ?? 0) * ((vt.waypoint_fee ?? 0) / 100)
          : waypoint_count * (vt.waypoint_fee ?? 0)
        : 0;
      const babySeatFee =
        baby_seat_infant * (vt.baby_seat_infant_fee ?? 0) +
        baby_seat_convertible * (vt.baby_seat_convertible_fee ?? 0) +
        baby_seat_booster * (vt.baby_seat_booster_fee ?? 0);

      let subtotal = baseFare * surgeMultiplier;

      if (timeSurcharge) {
        subtotal =
          timeSurcharge.surcharge_type === 'FIXED'
            ? subtotal + timeSurcharge.surcharge_value
            : subtotal * (1 + timeSurcharge.surcharge_value / 100);
      }

      if (holidaySurcharge) {
        subtotal =
          holidaySurcharge.surcharge_type === 'FIXED'
            ? subtotal + holidaySurcharge.surcharge_value
            : subtotal * (1 + holidaySurcharge.surcharge_value / 100);
      }

      if (serviceTypeSurcharge?.surcharge_value > 0) {
        subtotal =
          serviceTypeSurcharge.surcharge_type === 'FIXED'
            ? subtotal + serviceTypeSurcharge.surcharge_value
            : subtotal * (1 + serviceTypeSurcharge.surcharge_value / 100);
      }

      subtotal += babySeatFee;

      if (contactDiscount > 0) {
        subtotal = subtotal * (1 - contactDiscount / 100);
      }

      if (promoDiscount && (promoDiscount.min_fare ?? 0) <= subtotal) {
        const discount =
          promoDiscount.type === 'FIXED'
            ? promoDiscount.value
            : (subtotal * promoDiscount.value) / 100;
        subtotal = Math.max(0, subtotal - discount);
      }

      subtotal = Math.max(subtotal, vt.minimum_fare ?? 0);

      if (billing_options.length === 0) {
        billing_options.push({
          method: 'BASE',
          fare: parseFloat(subtotal.toFixed(2)),
          label: 'Base fare',
        });
      }

      const extras = (allExtras ?? []).filter(
        (e: any) => e.tenant_vehicle_type_id === vt.id,
      );

      const max_baby_seats =
        vt.max_baby_seats !== null && vt.max_baby_seats !== undefined
          ? vt.max_baby_seats
          : Math.max((vt.max_passengers ?? 1) - 1, 0);

      return {
        vehicle_type_id: vt.id,
        type_name: vt.type_name,
        description: vt.description,
        max_luggage: vt.max_luggage,
        max_passengers: vt.max_passengers ?? 4,
        max_baby_seats,
        currency: vt.currency ?? 'AUD',
        billing_method: vt.billing_method ?? 'KM',
        pricing_model: vt.pricing_model ?? 'STRAIGHT',
        included_km: vt.included_km ?? 10,
        included_minutes: vt.included_minutes ?? 30,
        hourly_included_km: vt.hourly_included_km ?? 20,
        min_booking_hours: vt.min_booking_hours ?? 1,
        waypoint_fee: parseFloat(waypointFee.toFixed(2)),
        waypoint_fee_type: vt.waypoint_fee_type ?? 'FIXED',
        baby_seat_fee: parseFloat(babySeatFee.toFixed(2)),
        baby_seat_pricing: {
          infant: vt.baby_seat_infant_fee ?? 0,
          convertible: vt.baby_seat_convertible_fee ?? 0,
          booster: vt.baby_seat_booster_fee ?? 0,
        },
        billing_options,
        estimated_fare: parseFloat(subtotal.toFixed(2)),
        toll_cost: (vt.include_tolls !== false) ? toll_cost : 0,
        toll_estimated: true,
        total_with_tolls: parseFloat(
          (subtotal + ((vt.include_tolls !== false) ? toll_cost : 0)).toFixed(2),
        ),
        extras: extras.map((e: any) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          category: e.category,
          price: e.price,
          max_quantity: e.max_quantity,
        })),
        surcharges_applied: [
          surgeMultiplier > 1 ? `Surge ×${surgeMultiplier}` : null,
          timeSurcharge ? `${timeSurcharge.name}` : null,
          holidaySurcharge ? `${holidaySurcharge.name}` : null,
          serviceTypeSurcharge ? `${serviceTypeSurcharge.name}` : null,
          contactDiscount > 0 ? `${contactDiscount}% discount` : null,
          promoDiscount ? `Promo: ${promo_code}` : null,
        ].filter(Boolean),
      };
    });
  }

  private applyAllSurcharges(
    base_fare: number,
    vt: any,
    surgeMultiplier: number,
    timeSurcharge: any,
    holidaySurcharge: any,
    serviceTypeSurcharge: any,
    contactDiscount: number,
  ): number {
    let fare = base_fare;
    fare = fare * surgeMultiplier;

    if (timeSurcharge) {
      fare =
        timeSurcharge.surcharge_type === 'FIXED'
          ? fare + timeSurcharge.surcharge_value
          : fare * (1 + timeSurcharge.surcharge_value / 100);
    }

    if (holidaySurcharge) {
      fare =
        holidaySurcharge.surcharge_type === 'FIXED'
          ? fare + holidaySurcharge.surcharge_value
          : fare * (1 + holidaySurcharge.surcharge_value / 100);
    }

    if (serviceTypeSurcharge?.surcharge_value > 0) {
      fare =
        serviceTypeSurcharge.surcharge_type === 'FIXED'
          ? fare + serviceTypeSurcharge.surcharge_value
          : fare * (1 + serviceTypeSurcharge.surcharge_value / 100);
    }

    if (contactDiscount > 0) {
      fare = fare * (1 - contactDiscount / 100);
    }

    if (vt.minimum_fare && fare < vt.minimum_fare) {
      fare = vt.minimum_fare;
    }

    return fare;
  }

  private async getSurgeMultiplier(
    tenant_id: string,
    service_type: string,
    service_city_id?: string,
  ): Promise<number> {
    const { data } = await supabaseAdmin
      .from('pricing_rules')
      .select('surge_multiplier')
      .eq('tenant_id', tenant_id)
      .eq('service_type', service_type)
      .eq('is_active', true)
      .or(
        service_city_id
          ? `service_city_id.eq.${service_city_id},service_city_id.is.null`
          : 'service_city_id.is.null',
      )
      .order('service_city_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.surge_multiplier ?? 1.0;
  }

  private async getTimeSurcharge(tenant_id: string, pickup_datetime: string) {
    const dt = new Date(pickup_datetime);
    const timeStr = dt.toTimeString().slice(0, 5);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

    const { data } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .or(`day_type.eq.ALL,day_type.eq.${isWeekend ? 'WEEKEND' : 'WEEKDAY'}`);

    if (!data?.length) return null;

    return (
      data.find((ts: any) => {
        const start = ts.start_time.slice(0, 5);
        const end = ts.end_time.slice(0, 5);
        if (start > end) return timeStr >= start || timeStr <= end;
        return timeStr >= start && timeStr <= end;
      }) ?? null
    );
  }

  private async getHolidaySurcharge(tenant_id: string, pickup_datetime: string) {
    const dt = new Date(pickup_datetime);
    const dateStr = dt.toISOString().slice(0, 10);
    const monthDay = dateStr.slice(5);

    const { data } = await supabaseAdmin
      .from('tenant_holidays')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (!data?.length) return null;

    return (
      data.find((h: any) => (h.recurring ? h.date.slice(5) === monthDay : h.date === dateStr)) ??
      null
    );
  }

  private async getServiceTypeSurcharge(tenant_id: string, service_type: string) {
    const { data } = await supabaseAdmin
      .from('tenant_service_types')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('name', service_type)
      .eq('is_active', true)
      .maybeSingle();

    return data ?? null;
  }

  private async getContactDiscount(
    contact_id: string,
    service_type: string,
    tenant_id: string,
  ): Promise<number> {
    const { data } = await supabaseAdmin
      .from('contacts')
      .select('discount_p2p, discount_charter, discount_airport')
      .eq('id', contact_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!data) return 0;
    if (service_type === 'POINT_TO_POINT') return data.discount_p2p ?? 0;
    if (service_type === 'HOURLY_CHARTER') return data.discount_charter ?? 0;
    if (service_type === 'AIRPORT_PICKUP' || service_type === 'AIRPORT_DROPOFF') {
      return data.discount_airport ?? 0;
    }
    return 0;
  }

  async validatePromoCode(tenant_id: string, code: string) {
    const { data } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (!data) return null;

    const now = new Date();
    if (data.valid_from && new Date(data.valid_from) > now) return null;
    if (data.valid_until && new Date(data.valid_until) < now) return null;
    if (data.max_uses && data.used_count >= data.max_uses) return null;

    return {
      id: data.id,
      code: data.code,
      type: data.discount_type,
      value: data.discount_value,
      min_fare: data.min_fare,
    };
  }
}
