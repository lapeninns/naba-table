import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '@/lib/env';

import { GoogleBusinessProfileError } from './errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const key = env.googleBusinessProfile.tokenEncryptionKey;
  if (!key) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile token encryption key is not configured.',
      { code: 'GBP_NOT_CONFIGURED', status: 503 },
    );
  }

  const buffer = Buffer.from(key, 'base64url');
  if (buffer.length !== 32) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile token encryption key must decode to 32 bytes.',
      { code: 'GBP_INVALID_ENCRYPTION_KEY', status: 500 },
    );
  }

  return buffer;
}

export function encryptGoogleBusinessProfileSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, encrypted, tag].map((part) => part.toString('base64url')).join('.');
}

export function decryptGoogleBusinessProfileSecret(payload: string): string {
  const key = getEncryptionKey();
  const [ivPart, encryptedPart, tagPart] = payload.split('.');

  if (!ivPart || !encryptedPart || !tagPart) {
    throw new GoogleBusinessProfileError('Stored Google credential is malformed.', {
      code: 'GBP_MALFORMED_CREDENTIAL',
      status: 500,
    });
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const encrypted = Buffer.from(encryptedPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
