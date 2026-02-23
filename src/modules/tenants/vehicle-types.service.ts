import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

const VALID_PLATFORM_CLASSES = ['BUSINESS', 'FIRST', 'VAN', 'ELECTRIC'];

@Injectable()
export class VehicleTypesService {
  async getPlatformClasses() {
    const { data, error } = await supabaseAdmin
      .from('platform_vehicle_classes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getTenantVehicleTypes(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createVehicleType(
    tenant_id: string,
    dto: {
      name: string;
      description?: string;
      allowed_platform_classes: string[];
      sort_order?: number;
    },
  ) {
    const invalid = dto.allowed_platform_classes.filter(
      (c) => !VALID_PLATFORM_CLASSES.includes(c),
    );

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid platform classes: ${invalid.join(', ')}`,
      );
    }

    if (dto.allowed_platform_classes.length === 0) {
      throw new BadRequestException(
        'At least one platform class must be selected',
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .insert({
        tenant_id,
        name: dto.name,
        description: dto.description ?? null,
        allowed_platform_classes: dto.allowed_platform_classes,
        sort_order: dto.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          'A vehicle type with this name already exists',
        );
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async updateVehicleType(
    id: string,
    tenant_id: string,
    dto: {
      name?: string;
      description?: string;
      allowed_platform_classes?: string[];
      sort_order?: number;
      is_active?: boolean;
    },
  ) {
    if (dto.allowed_platform_classes) {
      const invalid = dto.allowed_platform_classes.filter(
        (c) => !VALID_PLATFORM_CLASSES.includes(c),
      );

      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid platform classes: ${invalid.join(', ')}`,
        );
      }

      if (dto.allowed_platform_classes.length === 0) {
        throw new BadRequestException(
          'At least one platform class must be selected',
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Vehicle type not found');
    return data;
  }

  async deleteVehicleType(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Vehicle type not found');
    return { message: 'Vehicle type deactivated' };
  }

  async getAvailableDriversForVehicleType(tenant_id: string, vehicle_type_id: string) {
    const { data: vehicleType } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('allowed_platform_classes')
      .eq('id', vehicle_type_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!vehicleType) throw new NotFoundException('Vehicle type not found');

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select(
        `
          id,
          is_available,
          rating,
          total_trips,
          profiles(first_name, last_name, phone),
          vehicles(
            id,
            make,
            model,
            year,
            color,
            plate_number,
            platform_class,
            is_active
          )
        `,
      )
      .eq('tenant_id', tenant_id)
      .eq('status', 'ACTIVE')
      .eq('is_available', true);

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).filter((driver: any) =>
      driver.vehicles?.some(
        (v: any) =>
          v.is_active &&
          vehicleType.allowed_platform_classes.includes(v.platform_class),
      ),
    );
  }
}
