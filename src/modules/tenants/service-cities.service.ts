import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

// 常用时区列表
const VALID_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Auckland',
];

@Injectable()
export class ServiceCitiesService {
  async getServiceCities(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_service_cities')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('city_name');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createServiceCity(
    tenant_id: string,
    dto: {
      city_name: string;
      country_code: string;
      timezone: string;
      currency?: string;
    },
  ) {
    if (!VALID_TIMEZONES.includes(dto.timezone)) {
      throw new BadRequestException(
        `Invalid timezone. Valid options: ${VALID_TIMEZONES.join(', ')}`,
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_service_cities')
      .insert({
        tenant_id,
        city_name: dto.city_name,
        country_code: dto.country_code.toUpperCase(),
        timezone: dto.timezone,
        currency: dto.currency ?? 'AUD',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('This city already exists for your tenant');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async deleteServiceCity(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_service_cities')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Service city not found');
    return { message: 'Service city removed' };
  }

  getValidTimezones() {
    return VALID_TIMEZONES;
  }
}
