import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

export const PLATFORM_SERVICE_TYPES = [
  {
    id: 'POINT_TO_POINT',
    name: 'Point to Point',
    base_type: 'POINT_TO_POINT',
    is_platform: true,
  },
  {
    id: 'HOURLY_CHARTER',
    name: 'Hourly Charter',
    base_type: 'HOURLY_CHARTER',
    is_platform: true,
  },
  {
    id: 'AIRPORT_PICKUP',
    name: 'Airport Pickup',
    base_type: 'POINT_TO_POINT',
    is_platform: true,
  },
  {
    id: 'AIRPORT_DROPOFF',
    name: 'Airport Dropoff',
    base_type: 'POINT_TO_POINT',
    is_platform: true,
  },
];

@Injectable()
export class ServiceTypesService {
  async findAll(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_service_types')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('sort_order', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    return {
      platform: PLATFORM_SERVICE_TYPES,
      custom: data ?? [],
    };
  }

  async create(
    tenant_id: string,
    dto: {
      name: string;
      description?: string;
      base_type: 'POINT_TO_POINT' | 'HOURLY_CHARTER';
      surcharge_type: 'FIXED' | 'PERCENTAGE';
      surcharge_value: number;
    },
  ) {
    const { data, error } = await supabaseAdmin
      .from('tenant_service_types')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Service type name already exists');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async update(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_service_types')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Service type not found');
    return data;
  }

  async remove(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_service_types')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Service type not found');
    return { message: 'Service type deactivated', id };
  }

  calculateSurcharge(base_fare: number, surcharge_type: string, surcharge_value: number): number {
    if (surcharge_type === 'FIXED') {
      return surcharge_value;
    }
    if (surcharge_type === 'PERCENTAGE') {
      return parseFloat(((base_fare * surcharge_value) / 100).toFixed(2));
    }
    return 0;
  }
}
