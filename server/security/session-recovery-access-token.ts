import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

import { normalizeEmail, normalizePhone } from '@/server/customers';

const TOKEN_PREFIX = 'sr2' as const;
const MAX_TTL_SECONDS = 2_592_000; // 30 days
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

const payloadSchema = z
  .object({
    v: z.literal(1),
    purpose: z.literal('session_recovery'),
    restaurantId: z.string().uuid(),
    email: z.string().email().nullable(),
    phone: z.string().min(7).max(50).nullable(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one contact method is required',
        path: ['email'],
      });
    }
  });

export type SessionRecoveryAccessTokenPayload = z.infer<typeof payloadSchema>;

export type SessionRecoveryAccessTokenValidationError =
  | 'invalid_format'
  | 'invalid_prefix'
  | 'invalid_payload'
  | 'invalid_signature'
  | 'expired';

export type SessionRecoveryAccessTokenValidationResult =
  | { ok: true; payload: SessionRecoveryAccessTokenPayload }
  | { ok: false; reason: SessionRecoveryAccessTokenValidationError; restaurantId?: string | null };

type SessionRecoveryBookingContact = {
  restaurantId: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
};

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
  return createHash('sha256').update(`session-recovery-access-token:${secret}`).digest();
}

function encryptPayload(secret: string, payload: SessionRecoveryAccessTokenPayload): string {
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

function normalizePhoneSafely(value: string | null | undefined): string | null {
  try {
    return normalizePhone(value) || null;
  } catch {
    return null;
  }
}

export function createSessionRecoveryAccessToken(params: {
  restaurantId: string;
  email?: string | null;
  phone?: string | null;
  secret: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const nowMs = params.now?.getTime() ?? Date.now();
  const ttlSeconds = Math.max(60, Math.min(params.ttlSeconds ?? 900, MAX_TTL_SECONDS));
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedPhone = normalizePhoneSafely(params.phone);

  if (!normalizedEmail && !normalizedPhone) {
    throw new Error('At least one contact method is required');
  }

  const payload: SessionRecoveryAccessTokenPayload = {
    v: 1,
    purpose: 'session_recovery',
    restaurantId: params.restaurantId,
    email: normalizedEmail || null,
    phone: normalizedPhone || null,
    iat: issuedAt,
    exp: expiresAt,
  };

  return encryptPayload(params.secret, payloadSchema.parse(payload));
}

export function validateSessionRecoveryAccessToken(
  token: string,
  params: { secret: string; now?: Date },
): SessionRecoveryAccessTokenValidationResult {
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

  let parsedPayload: SessionRecoveryAccessTokenPayload;
  try {
    parsedPayload = payloadSchema.parse(JSON.parse(decoded));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  const nowSeconds = Math.floor((params.now?.getTime() ?? Date.now()) / 1000);
  if (nowSeconds > parsedPayload.exp) {
    return {
      ok: false,
      reason: 'expired',
      restaurantId: parsedPayload.restaurantId,
    };
  }

  return { ok: true, payload: parsedPayload };
}

export function sessionRecoveryTokenMatchesBookingContact(params: {
  payload: SessionRecoveryAccessTokenPayload;
  booking: SessionRecoveryBookingContact;
}): boolean {
  const tokenEmail = normalizeEmail(params.payload.email);
  const tokenPhone = normalizePhoneSafely(params.payload.phone);

  if (!tokenEmail && !tokenPhone) {
    return false;
  }

  if (params.booking.restaurantId !== params.payload.restaurantId) {
    return false;
  }

  const bookingEmail = normalizeEmail(params.booking.email);
  const bookingPhone = tokenPhone ? normalizePhoneSafely(params.booking.phone) : null;

  if (tokenEmail && bookingEmail !== tokenEmail) {
    return false;
  }

  if (tokenPhone && bookingPhone !== tokenPhone) {
    return false;
  }

  return true;
}
