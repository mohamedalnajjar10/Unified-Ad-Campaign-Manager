import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const hex = configService.get<string>('ENCRYPTION_KEY');
    if (!hex || hex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be 64 hex characters (256-bit key for aes-256-gcm)',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException(
        `Invalid encrypted format: expected 3 colon-separated parts (iv:authTag:ciphertext), got ${parts.length}`,
      );
    }
    const [ivHex, authTagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
