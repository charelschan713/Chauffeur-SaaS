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
      waypoint_fee?: number;
      baby_seat_infant_fee?: number;
      baby_seat_convertible_fee?: number;
      baby_seat_booster_fee?: number;
      max_baby_seats?: number | null;
      included_km_per_hour?: number;
      extra_km_rate?: number;
      hourly_rate: number;
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
        waypoint_fee: type_data.waypoint_fee ?? 0,
        baby_seat_infant_fee: type_data.baby_seat_infant_fee ?? 0,
        baby_seat_convertible_fee: type_data.baby_seat_convertible_fee ?? 0,
        baby_seat_booster_fee: type_data.baby_seat_booster_fee ?? 0,
        max_baby_seats:
          type_data.max_baby_seats === undefined ? null : type_data.max_baby_seats,
        included_km_per_hour: type_data.included_km_per_hour ?? 0,
        extra_km_rate: type_data.extra_km_rate ?? 0,
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
      waypoint_fee?: number;
      baby_seat_infant_fee?: number;
      baby_seat_convertible_fee?: number;
      baby_seat_booster_fee?: number;
      max_baby_seats?: number | null;
      included_km_per_hour?: number;
      extra_km_rate?: number;
      hourly_rate?: number;
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
