import { Injectable, BadRequestException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class SurchargesService {
  async getTime(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('start_time');

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createTime(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .insert({ tenant_id, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateTime(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteTime(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_time_surcharges')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getHoliday(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_holiday_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('date');

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createHoliday(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_holiday_surcharges')
      .insert({ tenant_id, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateHoliday(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_holiday_surcharges')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteHoliday(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_holiday_surcharges')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getEvent(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_event_surcharges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('start_date');

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createEvent(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_event_surcharges')
      .insert({ tenant_id, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateEvent(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_event_surcharges')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteEvent(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_event_surcharges')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getAirport(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_airport_rules')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('name');

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createAirport(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_airport_rules')
      .insert({ tenant_id, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateAirport(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('tenant_airport_rules')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteAirport(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_airport_rules')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }
}
