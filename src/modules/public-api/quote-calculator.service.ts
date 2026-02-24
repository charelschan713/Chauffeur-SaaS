import { Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class QuoteCalculatorService {
  async calculate(params: {
    tenant_id: string;
    service_type: string;
    pickup_datetime?: string;
    return_datetime?: string;
    distance_km?: number;
    duration_minutes?: number;
    duration_hours?: number;
    hours?: number;
    waiting_minutes?: number;
    waypoint_count?: number;
    passenger_count?: number;
    luggage_count?: number;
    baby_seat_infant?: number;
    baby_seat_convertible?: number;
    baby_seat_booster?: number;
    toll_cost?: number;
    pickup_address?: string;
    dropoff_address?: string;
    pickup_place_id?: string;
    dropoff_place_id?: string;
    promo_code?: string;
    contact_id?: string;
    service_city_id?: string;
    trip_type?: string;
  }) {
    return this.calculateQuote(params);
  }

  async calculateQuote(params: {
    tenant_id: string;
    service_type: string;
    pickup_datetime?: string;
    return_datetime?: string;
    distance_km?: number;
    duration_minutes?: number;
    duration_hours?: number;
    hours?: number;
    waiting_minutes?: number;
    waypoint_count?: number;
    passenger_count?: number;
    luggage_count?: number;
    baby_seat_infant?: number;
    baby_seat_convertible?: number;
    baby_seat_booster?: number;
    toll_cost?: number;
    pickup_address?: string;
    dropoff_address?: string;
    pickup_place_id?: string;
    dropoff_place_id?: string;
    promo_code?: string;
    contact_id?: string;
    service_city_id?: string;
    trip_type?: string;
  }) {
    const {
      tenant_id,
      service_type,
      pickup_datetime,
      distance_km = 0,
      duration_minutes = 0,
      duration_hours = 0,
      hours,
      waiting_minutes = 0,
      waypoint_count = 0,
      baby_seat_infant = 0,
      baby_seat_convertible = 0,
      baby_seat_booster = 0,
      toll_cost = 0,
      pickup_address = '',
      dropoff_address = '',
      pickup_place_id,
      dropoff_place_id,
      promo_code,
      contact_id,
      service_city_id,
      trip_type = 'ONE_WAY',
    } = params;

    const resolvedHours = hours ?? duration_hours ?? 0;

    const { data: vehicleTypes } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!vehicleTypes?.length) return [];

    const [
      timeSurcharge,
      holidaySurcharge,
      eventSurcharge,
      airportRule,
      serviceTypeSurcharge,
      surgeMultiplier,
      contactDiscount,
      promo,
    ] = await Promise.all([
      pickup_datetime ? this.getTimeSurcharge(tenant_id, pickup_datetime) : null,
      pickup_datetime ? this.getHolidaySurcharge(tenant_id, pickup_datetime) : null,
      pickup_datetime
        ? this.getEventSurcharge(tenant_id, pickup_datetime, trip_type)
        : null,
      this.getAirportRule(
        tenant_id,
        pickup_address,
        dropoff_address,
        pickup_place_id,
        dropoff_place_id,
      ),
      this.getServiceTypeSurcharge(tenant_id, service_type),
      this.getSurgeMultiplier(tenant_id, service_type, service_city_id),
      contact_id
        ? this.getContactDiscount(contact_id, service_type, tenant_id)
        : 0,
      promo_code ? this.validatePromoCode(tenant_id, promo_code) : null,
    ]);

    return vehicleTypes.map((vt: any) => {
      const effectiveServiceType = this.resolveEffectiveServiceType(
        service_type,
        serviceTypeSurcharge,
      );

      const pricing = this.calculatePricingDetails({
        vt,
        service_type: effectiveServiceType,
        distance_km,
        duration_minutes,
        hours: resolvedHours,
        waiting_minutes,
        waypoint_count,
        toll_cost,
      });

      const baby_seat_fee =
        baby_seat_infant * (vt.baby_seat_infant_fee ?? 0) +
        baby_seat_convertible * (vt.baby_seat_convertible_fee ?? 0) +
        baby_seat_booster * (vt.baby_seat_booster_fee ?? 0);

      const airport_parking_fee = airportRule ? airportRule.parking_fee ?? 0 : 0;

      const baseSubtotal = pricing.subtotal + baby_seat_fee + airport_parking_fee;

      const fare_after_surcharges = this.applyAllSurcharges(
        baseSubtotal,
        vt,
        surgeMultiplier,
        timeSurcharge,
        holidaySurcharge,
        eventSurcharge,
        serviceTypeSurcharge,
        contactDiscount,
      );

      let promo_discount = 0;
      if (promo) {
        if (!promo.min_fare || fare_after_surcharges >= promo.min_fare) {
          promo_discount =
            promo.type === 'PERCENTAGE'
              ? fare_after_surcharges * (promo.value / 100)
              : promo.value;
        }
      }

      const subtotalAfterDiscount = Math.max(
        fare_after_surcharges - promo_discount,
        vt.minimum_fare ?? 0,
      );

      const total = this.round2(subtotalAfterDiscount + pricing.toll_fee);

      const max_baby_seats =
        vt.max_baby_seats !== null && vt.max_baby_seats !== undefined
          ? vt.max_baby_seats
          : Math.max((vt.max_passengers ?? 1) - 1, 0);

      const surcharges_applied = [
        surgeMultiplier > 1 ? `Surge ×${surgeMultiplier}` : null,
        timeSurcharge
          ? `${timeSurcharge.name} +${timeSurcharge.surcharge_value}${
              timeSurcharge.surcharge_type === 'PERCENTAGE' ? '%' : '$'
            }`
          : null,
        holidaySurcharge
          ? `${holidaySurcharge.name} +${holidaySurcharge.surcharge_value}${
              holidaySurcharge.surcharge_type === 'PERCENTAGE' ? '%' : '$'
            }`
          : null,
        eventSurcharge
          ? `${eventSurcharge.name} +${eventSurcharge.surcharge_value}${
              eventSurcharge.surcharge_type === 'PERCENTAGE' ? '%' : '$'
            }`
          : null,
        airport_parking_fee > 0 ? `Airport Parking $${airport_parking_fee}` : null,
        serviceTypeSurcharge ? `${serviceTypeSurcharge.name}` : null,
        contactDiscount > 0 ? `${contactDiscount}% client discount` : null,
        promo_discount > 0 ? `Promo: ${promo_code}` : null,
      ].filter(Boolean);

      return {
        vehicle_type_id: vt.id,
        type_name: vt.type_name,
        description: vt.description,
        max_passengers: vt.max_passengers ?? 4,
        max_luggage: vt.max_luggage ?? 2,
        max_baby_seats,
        currency: 'AUD',
        fare_breakdown: {
          base_fare: this.round2(pricing.base_fare),
          km_charge: this.round2(pricing.km_charge),
          time_charge: this.round2(pricing.time_charge),
          waiting_charge: this.round2(pricing.waiting_charge),
          waypoint_charge: this.round2(pricing.waypoint_charge),
          toll_fee: this.round2(pricing.toll_fee),
          subtotal: this.round2(pricing.subtotal),
          surcharges: surcharges_applied,
          extras: [
            baby_seat_fee > 0 ? `Baby seats $${this.round2(baby_seat_fee)}` : null,
            airport_parking_fee > 0
              ? `Airport parking $${this.round2(airport_parking_fee)}`
              : null,
            promo_discount > 0
              ? `Promo discount -$${this.round2(promo_discount)}`
              : null,
          ].filter(Boolean),
          total,
        },
        estimated_fare: this.round2(subtotalAfterDiscount),
        toll_cost: this.round2(pricing.toll_fee),
        toll_estimated: true,
        total_with_tolls: total,
        billing_method: vt.billing_method ?? 'KM',
        pricing_model: vt.pricing_model ?? 'STRAIGHT',
        included_km: vt.included_km ?? 10,
        included_minutes: vt.included_minutes ?? 30,
        baby_seat_pricing: {
          infant: vt.baby_seat_infant_fee ?? 0,
          convertible: vt.baby_seat_convertible_fee ?? 0,
          booster: vt.baby_seat_booster_fee ?? 0,
        },
        surcharges_applied,
        airport_rule: airportRule
          ? {
              name: airportRule.name,
              terminal_type: airportRule.terminal_type,
              free_waiting_minutes: airportRule.free_waiting_minutes,
              parking_fee: airportRule.parking_fee,
            }
          : null,
      };
    });
  }

  private resolveEffectiveServiceType(service_type: string, serviceTypeSurcharge: any) {
    if (service_type !== 'SPECIAL_EVENT') return service_type;

    const base = serviceTypeSurcharge?.base_service_type;
    if (base === 'HOURLY_CHARTER') return 'HOURLY_CHARTER';
    return 'POINT_TO_POINT';
  }

  private calculatePricingDetails(args: {
    vt: any;
    service_type: string;
    distance_km: number;
    duration_minutes: number;
    hours: number;
    waiting_minutes: number;
    waypoint_count: number;
    toll_cost: number;
  }) {
    const {
      vt,
      service_type,
      distance_km,
      duration_minutes,
      hours,
      waiting_minutes,
      waypoint_count,
      toll_cost,
    } = args;

    const base_fare = vt.base_fare ?? 0;
    let km_charge = 0;
    let time_charge = 0;
    let waiting_charge = 0;
    let waypoint_charge = 0;

    if (service_type === 'HOURLY_CHARTER') {
      const billableHours = Math.max(hours, vt.min_booking_hours ?? 1);
      const includedKm = (vt.hourly_included_km ?? vt.included_km ?? 0) * billableHours;
      const extraKm = Math.max(0, distance_km - includedKm);
      const overtimeMinutes = Math.max(0, duration_minutes - billableHours * 60);

      km_charge = extraKm * (vt.per_km_rate ?? 0);
      time_charge = (vt.hourly_rate ?? 0) * billableHours;
      waiting_charge = overtimeMinutes * (vt.extra_minute_rate ?? 0);
      waypoint_charge = 0;
    } else {
      // POINT_TO_POINT / AIRPORT / SPECIAL_EVENT(base P2P)
      const freeWaiting = vt.waiting_minutes_free ?? 0;
      const billableWaiting = Math.max(0, waiting_minutes - freeWaiting);

      km_charge = distance_km * (vt.per_km_rate ?? 0);
      time_charge = duration_minutes * (vt.per_minute_rate ?? 0);
      waiting_charge = billableWaiting * (vt.extra_minute_rate ?? 0);
      waypoint_charge = this.calculateWaypointFee(vt, base_fare, waypoint_count);
    }

    const subtotal =
      base_fare + km_charge + time_charge + waiting_charge + waypoint_charge + (toll_cost || 0);

    return {
      base_fare,
      km_charge,
      time_charge,
      waiting_charge,
      waypoint_charge,
      toll_fee: toll_cost || 0,
      subtotal,
    };
  }

  private calculateWaypointFee(
    vt: any,
    base_fare: number,
    waypoint_count: number,
  ): number {
    if (!waypoint_count || !vt.waypoint_fee) return 0;

    if (vt.waypoint_fee_type === 'PERCENTAGE') {
      return waypoint_count * base_fare * ((vt.waypoint_fee ?? 0) / 100);
    }

    return waypoint_count * (vt.waypoint_fee ?? 0);
  }

  private applyAllSurcharges(
    base_fare: number,
    vt: any,
    surgeMultiplier: number,
    timeSurcharge: any,
    holidaySurcharge: any,
    eventSurcharge: any,
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

    if (eventSurcharge) {
      fare =
        eventSurcharge.surcharge_type === 'FIXED'
          ? fare + eventSurcharge.surcharge_value
          : fare * (1 + eventSurcharge.surcharge_value / 100);
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

  private round2(v: number) {
    return Math.round((v || 0) * 100) / 100;
  }

  private async getEventSurcharge(
    tenant_id: string,
    pickup_datetime: string,
    trip_type: string,
  ) {
    const dateStr = new Date(pickup_datetime).toISOString().slice(0, 10);

    const { data } = await supabaseAdmin
      .from('tenant_event_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr);

    if (!data?.length) return null;

    const event = data[0];
    const rate = trip_type === 'RETURN' ? event.return_rate ?? 50 : event.one_way_rate ?? 100;

    return {
      ...event,
      surcharge_value: rate,
      surcharge_type: 'PERCENTAGE',
    };
  }

  private async getAirportRule(
    tenant_id: string,
    pickup_address: string,
    dropoff_address: string,
    pickup_place_id?: string,
    dropoff_place_id?: string,
  ) {
    const { data: rules } = await supabaseAdmin
      .from('tenant_airport_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (!rules?.length) return null;

    for (const rule of rules) {
      if (rule.place_id) {
        if (rule.place_id === pickup_place_id || rule.place_id === dropoff_place_id) {
          return rule;
        }
      }

      if (rule.address_keywords?.length) {
        const combined = `${pickup_address} ${dropoff_address}`.toLowerCase();
        const matched = rule.address_keywords.some((kw: string) =>
          combined.includes(kw.toLowerCase()),
        );
        if (matched) return rule;
      }
    }

    return null;
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

    const { data } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (!data?.length) return null;

    return (
      data.find((ts: any) => {
        const start = ts.start_time.slice(0, 5);
        const end = ts.end_time.slice(0, 5);
        if (start > end) {
          return timeStr >= start || timeStr <= end;
        }
        return timeStr >= start && timeStr <= end;
      }) ?? null
    );
  }

  private async getHolidaySurcharge(tenant_id: string, pickup_datetime: string) {
    const dt = new Date(pickup_datetime);
    const dateStr = dt.toISOString().slice(0, 10);
    const monthDay = dateStr.slice(5);

    const { data } = await supabaseAdmin
      .from('tenant_holiday_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (!data?.length) return null;

    return (
      data.find((h: any) =>
        h.is_recurring ? h.date?.slice(5) === monthDay : h.date === dateStr,
      ) ?? null
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
    if (service_type === 'AIRPORT_PICKUP' || service_type === 'AIRPORT_DROPOFF')
      return data.discount_airport ?? 0;

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
