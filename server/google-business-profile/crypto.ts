import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function getBaseSecret(): string {
  const secret = env.integrations.googleBusinessProfile.tokenEncryptionKey;
  if (!secret) {
    throw new Error('Google Business Profile token encryption key is not configured.');
  }

  return secret;
}

function deriveKey(label: string): Buffer {
  return createHmac('sha256', Buffer.from(getBaseSecret(), 'utf8')).update(label).digest();
}

function encodeBase64Url(input: Buffer | string): string {
  return Buffer.isBuffer(input) ? input.toString('base64url') : Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function encryptGoogleBusinessProfileSecret(value: string): string {
  const key = deriveKey('google-business-profile-token');
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [encodeBase64Url(iv), encodeBase64Url(authTag), encodeBase64Url(ciphertext)].join('.');
}

export function decryptGoogleBusinessProfileSecret(payload: string): string {
  const [ivPart, authTagPart, ciphertextPart] = payload.split('.');
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error('Malformed encrypted Google Business Profile secret.');
  }

  const key = deriveKey('google-business-profile-token');
  const decipher = createDecipheriv('aes-256-gcm', key, decodeBase64Url(ivPart));
  decipher.setAuthTag(decodeBase64Url(authTagPart).subarray(0, AUTH_TAG_LENGTH_BYTES));

  const plaintext = Buffer.concat([
    decipher.update(decodeBase64Url(ciphertextPart)),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

type SignedStatePayload = {
  restaurantId: string;
  returnTo: string;
  issuedAt: number;
  redirectUri?: string;
  returnOrigin?: string;
};

export function signGoogleBusinessProfileState(payload: SignedStatePayload): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = encodeBase64Url(
    createHmac('sha256', deriveKey('google-business-profile-state')).update(body).digest(),
  );
  return `${body}.${signature}`;
}

export function verifyGoogleBusinessProfileState(
  state: string,
  options: { nowMs?: number; maxAgeMs?: number } = {},
): SignedStatePayload {
  const [body, signature] = state.split('.');
  if (!body || !signature) {
    throw new Error('Invalid Google Business Profile state.');
  }

  const expected = createHmac('sha256', deriveKey('google-business-profile-state')).update(body).digest();
  const actual = decodeBase64Url(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Invalid Google Business Profile state signature.');
  }

  const parsed = JSON.parse(decodeBase64Url(body).toString('utf8')) as SignedStatePayload;
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 10 * 60 * 1000;
  if (typeof parsed.issuedAt !== 'number' || nowMs - parsed.issuedAt > maxAgeMs) {
    throw new Error('Google Business Profile state has expired.');
  }

  return parsed;
}

export function createGoogleBusinessProfileNonce(): string {
  return randomBytes(12).toString('hex');
}

export function hashGoogleBusinessProfileNonce(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
