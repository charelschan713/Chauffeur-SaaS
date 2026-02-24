import { BadRequestException, Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class PlatformAirportsService {
  async findAll(includeInactive = false) {
    let q = supabaseAdmin.from('platform_airports').select('*').order('city').order('name');
    if (!includeInactive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(dto: { name: string; city: string; google_place_id?: string; keywords?: string[]; is_active?: boolean }) {
    const { data, error } = await supabaseAdmin
      .from('platform_airports')
      .insert({
        name: dto.name,
        city: dto.city,
        google_place_id: dto.google_place_id ?? null,
        keywords: dto.keywords ?? [],
        is_active: dto.is_active ?? true,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('platform_airports')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async findByPlaceId(place_id?: string) {
    if (!place_id) return null;
    const { data } = await supabaseAdmin
      .from('platform_airports')
      .select('*')
      .eq('google_place_id', place_id)
      .eq('is_active', true)
      .maybeSingle();
    return data ?? null;
  }

  async findByKeyword(address?: string) {
    if (!address) return null;
    const q = address.toLowerCase();
    const { data } = await supabaseAdmin
      .from('platform_airports')
      .select('*')
      .eq('is_active', true);
    const matched = (data ?? []).find((a: any) => (a.keywords ?? []).some((k: string) => q.includes(String(k).toLowerCase())));
    return matched ?? null;
  }
}
