import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class TenantKeysService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor() {
    const key = process.env.API_KEYS_ENCRYPTION_SECRET!;
    if (!key || key.length < 32) {
      throw new Error(
        'API_KEYS_ENCRYPTION_SECRET must be at least 32 characters',
      );
    }
    this.encryptionKey = Buffer.from(key.slice(0, 32));
  }

  // 加密
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  // 解密
  private decrypt(encryptedData: string): string {
    const [ivHex, tagHex, encryptedHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // 保存租户Keys（加密后存入DB）
  async saveKeys(tenant_id: string, keys: Record<string, string>) {
    const encrypted: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v) encrypted[k] = this.encrypt(v);
    }

    const { data: current } = await supabaseAdmin
      .from('tenants')
      .select('api_keys')
      .eq('id', tenant_id)
      .single();

    const merged = { ...(current?.api_keys ?? {}), ...encrypted };

    const { error } = await supabaseAdmin
      .from('tenants')
      .update({ api_keys: merged })
      .eq('id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'API keys saved successfully' };
  }

  // 取出并解密租户Keys（内部使用）
  async getDecryptedKeys(tenant_id: string): Promise<Record<string, string>> {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('api_keys')
      .eq('id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Tenant not found');

    const keys: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.api_keys ?? {})) {
      try {
        keys[k] = this.decrypt(v as string);
      } catch {
        keys[k] = '';
      }
    }
    return keys;
  }

  // 检查哪些Key已配置（不返回值，只返回boolean）
  async getKeysStatus(tenant_id: string) {
    const { data } = await supabaseAdmin
      .from('tenants')
      .select('api_keys')
      .eq('id', tenant_id)
      .single();

    const keys = data?.api_keys ?? {};
    return {
      stripe: !!keys['stripe_secret_key'],
      resend: !!keys['resend_api_key'],
      twilio: !!(keys['twilio_account_sid'] && keys['twilio_auth_token']),
    };
  }
}
