import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class TenantVehiclesService {
  async findAll(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicles')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicles')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Registration plate already exists');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async update(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_vehicles')
      .update({ ...dto, updated_at: new Date().toISOString() })
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
      .from('tenant_vehicles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Deleted', id };
  }

  async toggleActive(id: string, tenant_id: string) {
    const { data: current } = await supabaseAdmin
      .from('tenant_vehicles')
      .select('is_active')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!current) throw new NotFoundException();

    const { data, error } = await supabaseAdmin
      .from('tenant_vehicles')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
