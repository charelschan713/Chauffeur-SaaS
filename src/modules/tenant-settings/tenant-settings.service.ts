import { BadRequestException, Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class TenantSettingsService {
  private defaults = {
    theme_mode: 'light',
    primary_color: '#000000',
    primary_foreground: '#FFFFFF',
    sidebar_bg: '#FFFFFF',
    sidebar_fg: '#000000',
    card_bg: '#FFFFFF',
    accent_color: '#000000',
  };

  async getTheme(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .select('tenant_id, theme_mode, primary_color, primary_foreground, sidebar_bg, sidebar_fg, card_bg, accent_color')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) return { tenant_id, ...this.defaults };
    return { ...this.defaults, ...data };
  }

  async updateTheme(tenant_id: string, dto: any) {
    const payload = {
      tenant_id,
      theme_mode: dto.theme_mode ?? this.defaults.theme_mode,
      primary_color: dto.primary_color ?? this.defaults.primary_color,
      primary_foreground: dto.primary_foreground ?? this.defaults.primary_foreground,
      sidebar_bg: dto.sidebar_bg ?? this.defaults.sidebar_bg,
      sidebar_fg: dto.sidebar_fg ?? this.defaults.sidebar_fg,
      card_bg: dto.card_bg ?? this.defaults.card_bg,
      accent_color: dto.accent_color ?? this.defaults.accent_color,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select('tenant_id, theme_mode, primary_color, primary_foreground, sidebar_bg, sidebar_fg, card_bg, accent_color')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
