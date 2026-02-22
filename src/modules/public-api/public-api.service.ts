import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class PublicApiService {
  async getQuote(
    tenant_id: string,
    vehicle_class: string,
    pickup_address: string,
    dropoff_address: string,
    pickup_lat: number,
    pickup_lng: number,
    dropoff_lat: number,
    dropoff_lng: number,
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
        'No pricing available for this vehicle class',
      );

    const distance_km = this.calcDistance(
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
    );
    const duration_minutes = Math.round(distance_km * 1.5);
    const calculated =
      rule.base_fare +
      rule.price_per_km * distance_km +
      rule.price_per_minute * duration_minutes;
    const total = parseFloat(
      Math.max(calculated, rule.minimum_fare).toFixed(2),
    );

    return {
      vehicle_class,
      pickup_address,
      dropoff_address,
      distance_km: parseFloat(distance_km.toFixed(2)),
      duration_minutes,
      base_fare: rule.base_fare,
      total_price: total,
      currency: rule.currency,
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

    const { data: rule } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('vehicle_class', dto.vehicle_class)
      .eq('is_active', true)
      .single();

    if (!rule) throw new NotFoundException('No pricing rule found');

    const distance_km = this.calcDistance(
      dto.pickup_lat,
      dto.pickup_lng,
      dto.dropoff_lat,
      dto.dropoff_lng,
    );
    const duration_minutes = Math.round(distance_km * 1.5);
    const calculated =
      rule.base_fare +
      rule.price_per_km * distance_km +
      rule.price_per_minute * duration_minutes;
    const total_price = parseFloat(
      Math.max(calculated, rule.minimum_fare).toFixed(2),
    );

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
        vehicle_class: dto.vehicle_class,
        passenger_count: dto.passenger_count ?? 1,
        special_requests: dto.special_requests ?? null,
        flight_number: dto.flight_number ?? null,
        base_price: rule.base_fare,
        total_price,
        currency: rule.currency,
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
        vehicle_class, total_price, currency, passenger_count,
        flight_number, special_requests, created_at
      `,
      )
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  async getAvailableVehicleClasses(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .select('vehicle_class, base_fare, minimum_fare, currency')
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
