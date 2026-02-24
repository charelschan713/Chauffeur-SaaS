import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class SurchargesService {
  async getTimeSurcharges(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('start_time');

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createTimeSurcharge(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteTimeSurcharge(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException();
    return { message: 'Deleted', id };
  }

  async getHolidays(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_holidays')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('date');

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createHoliday(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_holidays')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteHoliday(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_holidays')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException();
    return { message: 'Deleted', id };
  }

  async getPromoCodes(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createPromoCode(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({ ...dto, tenant_id, code: dto.code.toUpperCase() })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Promo code already exists');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async deletePromoCode(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('promo_codes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException();
    return { message: 'Deleted', id };
  }
}
