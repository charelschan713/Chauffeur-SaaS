import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class VehicleTypesService {
  async findByTenant(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select(`
        *,
        requirements:vehicle_type_requirements(
          id,
          platform_vehicle:platform_vehicles(
            id, make, model, images
          )
        )
      `)
      .eq('tenant_id', tenant_id)
      .order('sort_order', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(
    tenant_id: string,
    dto: {
      type_name: string;
      description?: string;
      max_luggage: number;
      max_passengers?: number;
      base_fare: number;
      per_km_rate: number;
      per_minute_rate?: number;
      pricing_model?: 'STRAIGHT' | 'INCLUDED';
      included_km?: number;
      included_minutes?: number;
      extra_km_rate?: number;
      extra_minute_rate?: number;
      waiting_minutes_free?: number;
      waiting_rate?: number;
      hourly_rate?: number;
      hourly_included_km?: number;
      min_booking_hours?: number;
      free_waiting_standard?: number;
      free_waiting_domestic?: number;
      free_waiting_international?: number;
      waypoint_fee?: number;
      waypoint_fee_type?: 'FIXED' | 'PERCENTAGE';
      baby_seat_infant_fee?: number;
      baby_seat_convertible_fee?: number;
      baby_seat_booster_fee?: number;
      max_baby_seats?: number | null;
      minimum_fare: number;
      currency: string;
      required_platform_vehicle_ids?: string[];
    },
  ) {
    const {
      required_platform_vehicle_ids = [],
      ...type_data
    } = dto;

    const { data: existing } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('type_name', type_data.type_name)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new BadRequestException('Vehicle type name already exists');
    }

    const { data: vehicle_type, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .insert({
        ...type_data,
        tenant_id,
        max_passengers: type_data.max_passengers ?? 4,
        per_minute_rate: type_data.per_minute_rate ?? 0,
        pricing_model: type_data.pricing_model ?? 'STRAIGHT',
        included_km: type_data.included_km ?? 10,
        included_minutes: type_data.included_minutes ?? 30,
        extra_km_rate: type_data.extra_km_rate ?? 0,
        extra_minute_rate: type_data.extra_minute_rate ?? 0,
        waiting_minutes_free: type_data.waiting_minutes_free ?? 0,
        waiting_rate: type_data.waiting_rate ?? 0,
        hourly_rate: type_data.hourly_rate ?? 0,
        hourly_included_km: type_data.hourly_included_km ?? 20,
        min_booking_hours: type_data.min_booking_hours ?? 1,
        free_waiting_standard: type_data.free_waiting_standard ?? 15,
        free_waiting_domestic: type_data.free_waiting_domestic ?? 30,
        free_waiting_international: type_data.free_waiting_international ?? 60,
        waypoint_fee: type_data.waypoint_fee ?? 0,
        waypoint_fee_type: type_data.waypoint_fee_type ?? 'FIXED',
        baby_seat_infant_fee: type_data.baby_seat_infant_fee ?? 0,
        baby_seat_convertible_fee: type_data.baby_seat_convertible_fee ?? 0,
        baby_seat_booster_fee: type_data.baby_seat_booster_fee ?? 0,
        max_baby_seats:
          type_data.max_baby_seats === undefined ? null : type_data.max_baby_seats,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    if (required_platform_vehicle_ids.length > 0) {
      const { error: req_error } = await supabaseAdmin
        .from('vehicle_type_requirements')
        .insert(
          required_platform_vehicle_ids.map((platform_vehicle_id: string) => ({
            tenant_vehicle_type_id: vehicle_type.id,
            platform_vehicle_id,
            tenant_id,
          })),
        );

      if (req_error) throw new BadRequestException(req_error.message);
    }

    return this.findById(vehicle_type.id, tenant_id);
  }

  async update(
    id: string,
    tenant_id: string,
    dto: {
      type_name?: string;
      description?: string;
      max_luggage?: number;
      max_passengers?: number;
      base_fare?: number;
      per_km_rate?: number;
      per_minute_rate?: number;
      pricing_model?: 'STRAIGHT' | 'INCLUDED';
      included_km?: number;
      included_minutes?: number;
      extra_km_rate?: number;
      extra_minute_rate?: number;
      waiting_minutes_free?: number;
      waiting_rate?: number;
      hourly_rate?: number;
      hourly_included_km?: number;
      min_booking_hours?: number;
      free_waiting_standard?: number;
      free_waiting_domestic?: number;
      free_waiting_international?: number;
      waypoint_fee?: number;
      waypoint_fee_type?: 'FIXED' | 'PERCENTAGE';
      baby_seat_infant_fee?: number;
      baby_seat_convertible_fee?: number;
      baby_seat_booster_fee?: number;
      max_baby_seats?: number | null;
      minimum_fare?: number;
      currency?: string;
      is_active?: boolean;
      required_platform_vehicle_ids?: string[];
    },
  ) {
    const { required_platform_vehicle_ids, ...type_data } = dto;

    const { data: updated, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .update({
        ...type_data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Type not found');

    if (required_platform_vehicle_ids !== undefined) {
      const { error: delete_error } = await supabaseAdmin
        .from('vehicle_type_requirements')
        .delete()
        .eq('tenant_vehicle_type_id', id)
        .eq('tenant_id', tenant_id);

      if (delete_error) throw new BadRequestException(delete_error.message);

      if (required_platform_vehicle_ids.length > 0) {
        const { error: insert_error } = await supabaseAdmin
          .from('vehicle_type_requirements')
          .insert(
            required_platform_vehicle_ids.map((platform_vehicle_id: string) => ({
              tenant_vehicle_type_id: id,
              platform_vehicle_id,
              tenant_id,
            })),
          );

        if (insert_error) throw new BadRequestException(insert_error.message);
      }
    }

    return this.findById(updated.id, tenant_id);
  }

  async remove(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Type not found');
    return { message: 'Vehicle type deleted', id };
  }

  async findById(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select(`
        *,
        requirements:vehicle_type_requirements(
          id,
          platform_vehicle:platform_vehicles(
            id, make, model, images
          )
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error) throw new NotFoundException('Type not found');
    return data;
  }
}
