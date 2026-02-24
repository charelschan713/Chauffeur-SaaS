import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { QuoteCalculatorService } from './quote-calculator.service';

@Injectable()
export class PublicApiService {
  constructor(private readonly quoteCalculator: QuoteCalculatorService) {}

  async getQuote(query: {
    tenant_slug: string;
    service_type: string;
    service_city_id?: string;
    pickup_datetime?: string;
    distance_km?: string;
    duration_hours?: string;
    duration_minutes?: string;
    promo_code?: string;
    contact_id?: string;
  }) {
    const { data: tenant, error: tenant_error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug')
      .eq('slug', query.tenant_slug)
      .single();

    if (tenant_error) {
      throw new NotFoundException(`Tenant lookup failed: ${tenant_error.message}`);
    }

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const quotes = await this.quoteCalculator.calculate({
      tenant_id: tenant.id,
      service_type: query.service_type,
      service_city_id: query.service_city_id,
      pickup_datetime: query.pickup_datetime,
      distance_km: parseFloat(query.distance_km ?? '0'),
      duration_hours: parseFloat(query.duration_hours ?? '0'),
      duration_minutes: parseFloat(query.duration_minutes ?? '0'),
      promo_code: query.promo_code,
      contact_id: query.contact_id,
    });

    return {
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
      },
      service_type: query.service_type,
      distance_km: parseFloat(query.distance_km ?? '0'),
      duration_hours: parseFloat(query.duration_hours ?? '0'),
      quotes,
    };
  }

  async createBooking(tenant_id: string, dto: any) {
    let passenger_id = dto.passenger_id;

    if (!passenger_id && dto.passenger_email) {
      const { data: authUser } = await supabaseAdmin.auth.admin.listUsers();
      const existing = authUser.users.find(
        (u) => u.email === dto.passenger_email,
      );

      if (existing) {
        passenger_id = existing.id;
      } else {
        const tempPassword = Math.random().toString(36).slice(-12);
        const { data: newUser, error: userError } =
          await supabaseAdmin.auth.admin.createUser({
            email: dto.passenger_email,
            password: tempPassword,
            email_confirm: true,
          });

        if (userError) throw new BadRequestException(userError.message);

        passenger_id = newUser.user.id;

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: newUser.user.id,
            role: 'PASSENGER',
            first_name: dto.passenger_first_name ?? 'Guest',
            last_name: dto.passenger_last_name ?? '',
            phone: dto.passenger_phone ?? null,
            tenant_id: null,
          });

        if (profileError) throw new BadRequestException(profileError.message);
      }
    }

    if (!passenger_id) {
      throw new BadRequestException(
        'passenger_id or passenger_email is required',
      );
    }

    // Look up vehicle type for pricing
    const { data: vtype } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('id', dto.vehicle_type_id)
      .eq('is_active', true)
      .single();

    if (!vtype) throw new NotFoundException('Vehicle type not found');

    const distance_km = this.calcDistance(
      dto.pickup_lat,
      dto.pickup_lng,
      dto.dropoff_lat,
      dto.dropoff_lng,
    );
    const duration_minutes = Math.round(distance_km * 1.5);
    const per_km = vtype.per_km_rate ?? 0;
    const base = vtype.base_fare ?? 0;
    const min_fare = vtype.minimum_fare ?? 0;
    const calculated = base + per_km * distance_km;
    const total_price = parseFloat(Math.max(calculated, min_fare).toFixed(2));

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        tenant_id,
        passenger_id,
        pickup_address: dto.pickup_address,
        pickup_lat: dto.pickup_lat,
        pickup_lng: dto.pickup_lng,
        dropoff_address: dto.dropoff_address,
        dropoff_lat: dto.dropoff_lat,
        dropoff_lng: dto.dropoff_lng,
        pickup_datetime: dto.pickup_datetime,
        vehicle_type_id: dto.vehicle_type_id,
        passenger_count: dto.passenger_count ?? 1,
        special_requests: dto.special_requests ?? null,
        flight_number: dto.flight_number ?? null,
        base_price: base,
        total_price,
        currency: vtype.currency ?? 'AUD',
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getBooking(tenant_id: string, booking_id: string) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id, status, pickup_address, dropoff_address, pickup_datetime,
        vehicle_type_id, total_price, currency, passenger_count,
        flight_number, special_requests, created_at
      `,
      )
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  async getAvailableVehicleTypes(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('id, display_name, base_fare, minimum_fare, per_km_rate, currency, platform_vehicles(name, category)')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async cancelBooking(
    tenant_id: string,
    booking_id: string,
    reason?: string,
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(
        'Booking cannot be cancelled at this stage',
      );
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private calcDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
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
