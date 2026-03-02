import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const encKey = process.env.ENCRYPTION_KEY;
    if (!encKey) throw new Error('ENCRYPTION_KEY not set');
    this.key = Buffer.from(encKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    });
  }

  decrypt(ciphertext: string): string {
    const { iv, tag, data } = JSON.parse(ciphertext);
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
  }
}
