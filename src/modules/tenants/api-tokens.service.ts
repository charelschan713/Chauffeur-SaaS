import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { randomBytes } from 'crypto';

@Injectable()
export class ApiTokensService {
  async createToken(tenant_id: string, name: string) {
    const { data: existing } = await supabaseAdmin
      .from('tenant_api_tokens')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('name', name)
      .single();

    if (existing) {
      throw new BadRequestException('Token with this name already exists');
    }

    const token = `tk_${randomBytes(32).toString('hex')}`;

    const { data, error } = await supabaseAdmin
      .from('tenant_api_tokens')
      .insert({ tenant_id, name, token })
      .select('id, name, token, created_at')
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      ...data,
      message: 'Save this token now. It will not be shown again.',
    };
  }

  async listTokens(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_api_tokens')
      .select('id, name, last_used_at, is_active, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async revokeToken(token_id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('tenant_api_tokens')
      .update({ is_active: false })
      .eq('id', token_id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Token revoked' };
  }

  async validateToken(token: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('tenant_api_tokens')
      .select('tenant_id, is_active')
      .eq('token', token)
      .single();

    if (!data || !data.is_active) return null;

    supabaseAdmin
      .from('tenant_api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token)
      .then(() => {});

    return data.tenant_id;
  }
}
