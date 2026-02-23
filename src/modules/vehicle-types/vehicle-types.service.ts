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
        vehicles:tenant_vehicle_type_vehicles(
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
      included_km_per_hour?: number;
      extra_km_rate?: number;
      hourly_rate: number;
      minimum_fare: number;
      currency: string;
      vehicle_ids: string[];
    },
  ) {
    const { data: existing } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('type_name', dto.type_name)
      .single();

    if (existing) {
      throw new BadRequestException('Vehicle type name already exists');
    }

    if (dto.vehicle_ids.length > 0) {
      const { data: conflicts } = await supabaseAdmin
        .from('tenant_vehicle_type_vehicles')
        .select('platform_vehicle_id')
        .eq('tenant_id', tenant_id)
        .in('platform_vehicle_id', dto.vehicle_ids);

      if (conflicts && conflicts.length > 0) {
        throw new BadRequestException(
          'Some vehicles are already assigned to another type',
        );
      }
    }

    const { data: vtype, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .insert({
        tenant_id,
        type_name: dto.type_name,
        description: dto.description,
        max_luggage: dto.max_luggage,
        max_passengers: dto.max_passengers ?? 4,
        base_fare: dto.base_fare,
        per_km_rate: dto.per_km_rate,
        per_minute_rate: dto.per_minute_rate ?? 0,
        included_km_per_hour: dto.included_km_per_hour ?? 0,
        extra_km_rate: dto.extra_km_rate ?? 0,
        hourly_rate: dto.hourly_rate,
        minimum_fare: dto.minimum_fare,
        currency: dto.currency,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    if (dto.vehicle_ids.length > 0) {
      await this.assignVehicles(vtype.id, tenant_id, dto.vehicle_ids);
    }

    return this.findById(vtype.id);
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
      included_km_per_hour?: number;
      extra_km_rate?: number;
      hourly_rate?: number;
      minimum_fare?: number;
      currency?: string;
      is_active?: boolean;
      vehicle_ids?: string[];
    },
  ) {
    const { vehicle_ids, ...update_data } = dto;

    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .update({
        ...update_data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Type not found');

    if (vehicle_ids !== undefined) {
      await supabaseAdmin
        .from('tenant_vehicle_type_vehicles')
        .delete()
        .eq('vehicle_type_id', id)
        .eq('tenant_id', tenant_id);

      if (vehicle_ids.length > 0) {
        await this.assignVehicles(id, tenant_id, vehicle_ids);
      }
    }

    return this.findById(id);
  }

  async remove(id: string, tenant_id: string) {
    await supabaseAdmin
      .from('tenant_vehicle_type_vehicles')
      .delete()
      .eq('vehicle_type_id', id)
      .eq('tenant_id', tenant_id);

    const { error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Type not found');
    return { message: 'Vehicle type deleted', id };
  }

  async findById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select(`
        *,
        vehicles:tenant_vehicle_type_vehicles(
          id,
          platform_vehicle:platform_vehicles(
            id, make, model, images
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Type not found');
    return data;
  }

  private async assignVehicles(
    vehicle_type_id: string,
    tenant_id: string,
    vehicle_ids: string[],
  ) {
    const rows = vehicle_ids.map((vid) => ({
      vehicle_type_id,
      tenant_id,
      platform_vehicle_id: vid,
    }));

    const { error } = await supabaseAdmin
      .from('tenant_vehicle_type_vehicles')
      .insert(rows);

    if (error) throw new BadRequestException(error.message);
  }

  async getAssignedVehicleIds(tenant_id: string): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from('tenant_vehicle_type_vehicles')
      .select('platform_vehicle_id')
      .eq('tenant_id', tenant_id);

    return (data ?? []).map((d) => d.platform_vehicle_id);
  }
}
