import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  private generateApiKey(): { key: string; prefix: string } {
    const prefix = 'ck_live';
    const random = crypto.randomBytes(24).toString('hex');
    const key = `${prefix}_${random}`;
    return { key, prefix };
  }

  async createApiKey(
    tenant_id: string,
    user_id: string,
    key_name: string,
    expires_at?: string,
  ) {
    const { key, prefix } = this.generateApiKey();

    const { data, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .insert({
        tenant_id,
        key_name,
        api_key: key,
        key_prefix: prefix,
        expires_at: expires_at ?? null,
        created_by: user_id,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      ...data,
      api_key: key,
      message: 'Store this key securely. It will not be shown again.',
    };
  }

  async listApiKeys(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .select(
        'id, key_name, key_prefix, is_active, last_used_at, expires_at, created_at',
      )
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async revokeApiKey(key_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .update({ is_active: false })
      .eq('id', key_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Key not found');
    return { message: 'API key revoked', id: key_id };
  }

  async deleteApiKey(key_id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_api_keys')
      .delete()
      .eq('id', key_id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Key not found');
    return { message: 'API key deleted', id: key_id };
  }

  async validateApiKey(
    api_key: string,
  ): Promise<{ tenant_id: string; key_id: string } | null> {
    const { data, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('id, tenant_id, is_active, expires_at')
      .eq('api_key', api_key)
      .single();

    if (error || !data) return null;
    if (!data.is_active) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

    // Update last_used_at (fire and forget)
    supabaseAdmin
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(() => {});

    return { tenant_id: data.tenant_id, key_id: data.id };
  }
}
