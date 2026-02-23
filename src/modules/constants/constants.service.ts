import { BadRequestException, Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class ConstantsService {
  // 获取所有系统常量
  async getAllConstants() {
    const { data, error } = await supabaseAdmin
      .from('system_constants')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('sort_order');

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }

  // 获取租户自定义名称
  async getTenantLabels(tenant_id: string, language = 'en') {
    const { data, error } = await supabaseAdmin
      .from('tenant_constant_labels')
      .select(
        `
          id,
          custom_name,
          custom_description,
          language,
          system_constants(category, code, default_name)
        `,
      )
      .eq('tenant_id', tenant_id)
      .eq('language', language);

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 更新租户自定义名称
  async upsertTenantLabel(
    tenant_id: string,
    constant_id: string,
    custom_name: string,
    custom_description?: string,
    language = 'en',
  ) {
    if (!custom_name?.trim()) {
      throw new BadRequestException('custom_name cannot be empty');
    }

    if (custom_name.length > 100) {
      throw new BadRequestException('custom_name must be under 100 characters');
    }

    const { data: constant } = await supabaseAdmin
      .from('system_constants')
      .select('id, category')
      .eq('id', constant_id)
      .single();

    if (!constant) {
      throw new BadRequestException('Invalid constant_id');
    }

    const { data: existing } = await supabaseAdmin
      .from('tenant_constant_labels')
      .select(
        `
          id,
          custom_name,
          system_constants(category)
        `,
      )
      .eq('tenant_id', tenant_id)
      .eq('language', language)
      .neq('constant_id', constant_id);

    const duplicate = existing?.find(
      (e: any) =>
        e.system_constants?.category === constant.category &&
        e.custom_name.toLowerCase() === custom_name.toLowerCase(),
    );

    if (duplicate) {
      throw new BadRequestException(
        `Name "${custom_name}" already used in this category`,
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_constant_labels')
      .upsert(
        {
          tenant_id,
          constant_id,
          custom_name: custom_name.trim(),
          custom_description: custom_description?.trim() ?? null,
          language,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,constant_id,language' },
      )
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 批量更新租户自定义名称
  async batchUpsertLabels(
    tenant_id: string,
    labels: Array<{
      constant_id: string;
      custom_name: string;
      custom_description?: string;
    }>,
    language = 'en',
  ) {
    const results = [];
    const errors = [];

    for (const label of labels) {
      try {
        const result = await this.upsertTenantLabel(
          tenant_id,
          label.constant_id,
          label.custom_name,
          label.custom_description,
          language,
        );
        results.push(result);
      } catch (err: any) {
        errors.push({
          constant_id: label.constant_id,
          error: err.message,
        });
      }
    }

    return { updated: results.length, errors };
  }

  // 解析显示名称（API返回时用）
  async resolveLabels(
    tenant_id: string,
    items: any[],
    fields: string[],
    language = 'en',
  ) {
    const labels = await this.getTenantLabels(tenant_id, language);
    const labelMap: Record<string, string> = {};

    labels?.forEach((l: any) => {
      const key = `${l.system_constants.category}:${l.system_constants.code}`;
      labelMap[key] = l.custom_name;
    });

    return items.map((item) => {
      const resolved: any = { ...item };
      fields.forEach((field) => {
        const category = this.fieldToCategory(field);
        if (category && item[field]) {
          const key = `${category}:${item[field]}`;
          resolved[`${field}_label`] = labelMap[key] ?? item[field];
        }
      });
      return resolved;
    });
  }

  private fieldToCategory(field: string): string | null {
    const map: Record<string, string> = {
      vehicle_class: 'VEHICLE_CLASS',
      platform_class: 'VEHICLE_CLASS',
      service_type: 'SERVICE_TYPE',
      trip_type: 'TRIP_TYPE',
      booking_status: 'BOOKING_STATUS',
      driver_status: 'DRIVER_STATUS',
      payment_status: 'PAYMENT_STATUS',
    };

    return map[field] ?? null;
  }
}
