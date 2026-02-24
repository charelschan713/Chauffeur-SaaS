import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class VehicleTypeExtrasService {
  async findByVehicleType(tenant_vehicle_type_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('vehicle_type_extras')
      .select('*')
      .eq('tenant_vehicle_type_id', tenant_vehicle_type_id)
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('vehicle_type_extras')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('vehicle_type_extras')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException();
    return data;
  }

  async remove(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('vehicle_type_extras')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Deleted', id };
  }
}
