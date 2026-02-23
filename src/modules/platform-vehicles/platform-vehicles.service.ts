import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class PlatformVehiclesService {
  async findAll(include_inactive = false) {
    let q = supabaseAdmin
      .from('platform_vehicles')
      .select('*')
      .order('make', { ascending: true })
      .order('model', { ascending: true });

    if (!include_inactive) {
      q = q.eq('is_active', true);
    }

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(
    dto: {
      make: string;
      model: string;
      images?: string[];
    },
    created_by: string,
  ) {
    const { data, error } = await supabaseAdmin
      .from('platform_vehicles')
      .insert({
        make: dto.make.trim(),
        model: dto.model.trim(),
        images: dto.images ?? [],
        created_by,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(`${dto.make} ${dto.model} already exists`);
      }
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async update(
    id: string,
    dto: {
      make?: string;
      model?: string;
      images?: string[];
      is_active?: boolean;
    },
  ) {
    const { data, error } = await supabaseAdmin
      .from('platform_vehicles')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Vehicle not found');
    return data;
  }

  async remove(id: string) {
    const { error } = await supabaseAdmin
      .from('platform_vehicles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new NotFoundException('Vehicle not found');
    return { message: 'Vehicle deactivated', id };
  }

  async search(query: string) {
    const safe_query = query?.trim() ?? '';

    let q = supabaseAdmin
      .from('platform_vehicles')
      .select('*')
      .eq('is_active', true)
      .order('make')
      .limit(20);

    if (safe_query) {
      q = q.or(`make.ilike.%${safe_query}%,model.ilike.%${safe_query}%`);
    }

    const { data, error } = await q;

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async requestNewVehicle(
    make: string,
    model: string,
    driver_id: string,
    tenant_id: string,
  ) {
    const { data, error } = await supabaseAdmin
      .from('vehicle_requests')
      .insert({
        make: make.trim(),
        model: model.trim(),
        requested_by_driver: driver_id,
        tenant_id,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return {
      message: 'Request submitted. Admin will review shortly.',
      request_id: data.id,
    };
  }
}
