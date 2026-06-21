import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

import { normalizeEmail } from '@/server/customers';

// Encrypted, authenticated token embedded in the List-Unsubscribe URL/header so the
// public unsubscribe endpoint can suppress ONLY the recipient the email was sent to,
// with no enumeration risk. Mirrors the AES-256-GCM scheme used by
// session-recovery-access-token.ts but with its own prefix/purpose/AAD for domain
// separation, so the shared signing secret can never be cross-used between features.
const TOKEN_PREFIX = 'unsub1' as const;
const TOKEN_PURPOSE = 'email_unsubscribe' as const;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

// Unsubscribe links may sit in an inbox for a long time before they are used, so the
// TTL is generous. It is still bounded so a leaked token cannot live forever.
const DEFAULT_TTL_SECONDS = 365 * 24 * 60 * 60; // 365 days
const MAX_TTL_SECONDS = 400 * 24 * 60 * 60; // 400 days

const payloadSchema = z.object({
  v: z.literal(1),
  purpose: z.literal(TOKEN_PURPOSE),
  email: z.string().email(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export type UnsubscribeTokenPayload = z.infer<typeof payloadSchema>;

export type UnsubscribeTokenValidationError =
  | 'invalid_format'
  | 'invalid_prefix'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'expired';

export type UnsubscribeTokenValidationResult =
  | { ok: true; email: string }
  | { ok: false; reason: UnsubscribeTokenValidationError };

function base64UrlDecodeBuffer(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

function deriveEncryptionKey(secret: string): Buffer {
  return createHash('sha256').update(`email-unsubscribe-token:${secret}`).digest();
}

function encryptPayload(secret: string, payload: UnsubscribeTokenPayload): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveEncryptionKey(secret), iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  cipher.setAAD(Buffer.from(TOKEN_PREFIX, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.');
}

function decryptPayload(
  secret: string,
  ivB64: string,
  ciphertextB64: string,
  authTagB64: string,
): string | null {
  const iv = base64UrlDecodeBuffer(ivB64);
  const ciphertext = base64UrlDecodeBuffer(ciphertextB64);
  const authTag = base64UrlDecodeBuffer(authTagB64);

  if (
    !iv ||
    !ciphertext ||
    !authTag ||
    iv.length !== IV_LENGTH_BYTES ||
    authTag.length !== AUTH_TAG_LENGTH_BYTES
  ) {
    return null;
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveEncryptionKey(secret), iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAAD(Buffer.from(TOKEN_PREFIX, 'utf8'));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function createUnsubscribeToken(params: {
  email: string;
  secret: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) {
    throw new Error('A recipient email is required to create an unsubscribe token.');
  }

  const nowMs = params.now?.getTime() ?? Date.now();
  const ttlSeconds = Math.max(60, Math.min(params.ttlSeconds ?? DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS));
  const issuedAt = Math.floor(nowMs / 1000);

  const payload: UnsubscribeTokenPayload = {
    v: 1,
    purpose: TOKEN_PURPOSE,
    email: normalizedEmail,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };

  return encryptPayload(params.secret, payloadSchema.parse(payload));
}

export function validateUnsubscribeToken(
  token: string,
  params: { secret: string; now?: Date },
): UnsubscribeTokenValidationResult {
  const parts = token.split('.');
  if (parts.length !== 4) {
    return { ok: false, reason: 'invalid_format' };
  }

  const [prefix, ivB64, ciphertextB64, authTagB64] = parts;
  if (prefix !== TOKEN_PREFIX) {
    return { ok: false, reason: 'invalid_prefix' };
  }

  const decoded = decryptPayload(params.secret, ivB64, ciphertextB64, authTagB64);
  if (!decoded) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let payload: UnsubscribeTokenPayload;
  try {
    payload = payloadSchema.parse(JSON.parse(decoded));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  const nowSeconds = Math.floor((params.now?.getTime() ?? Date.now()) / 1000);
  if (nowSeconds > payload.exp) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, email: payload.email };
}
