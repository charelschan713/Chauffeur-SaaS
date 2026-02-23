import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class PassengersService {
  async findAll(tenant_id: string, query: any) {
    let q = supabaseAdmin
      .from('passengers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('total_rides', { ascending: false });

    if (query.search) {
      q = q.or(
        `first_name.ilike.%${query.search}%,` +
          `last_name.ilike.%${query.search}%,` +
          `phone.ilike.%${query.search}%`,
      );
    }

    const limit = parseInt(query.limit ?? '50', 10);
    q = q.limit(limit);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async findById(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('passengers')
      .select(`
        *,
        rides:bookings(
          id,
          booking_number,
          status,
          pickup_datetime,
          total_price,
          pickup_address,
          dropoff_address,
          driver:profiles(first_name, last_name)
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Passenger not found');
    return data;
  }

  async create(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('passengers')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('passengers')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Passenger not found');
    return data;
  }

  async remove(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('passengers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Passenger not found');
    return { message: 'Passenger deleted', id };
  }

  async updateRideStats(passenger_id: string) {
    const { data } = await supabaseAdmin
      .from('passengers')
      .select('total_rides')
      .eq('id', passenger_id)
      .single();

    if (!data) return;

    await supabaseAdmin
      .from('passengers')
      .update({
        total_rides: (data.total_rides ?? 0) + 1,
        last_ride_at: new Date().toISOString(),
      })
      .eq('id', passenger_id);
  }

  async findByPhone(phone: string, tenant_id: string) {
    const { data } = await supabaseAdmin
      .from('passengers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('phone', phone)
      .single();

    return data ?? null;
  }
}
