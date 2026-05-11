import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { normalizeEmail, normalizePhone } from '@/server/customers';

const TOKEN_PREFIX = 'sr1' as const;
const MAX_TTL_SECONDS = 2_592_000; // 30 days

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

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  try {
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function computeSignature(secret: string, payloadB64: string): string {
  return createHmac('sha256', secret).update(`${TOKEN_PREFIX}.${payloadB64}`).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
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

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(params.secret, payloadB64);
  return `${TOKEN_PREFIX}.${payloadB64}.${signature}`;
}

export function validateSessionRecoveryAccessToken(
  token: string,
  params: { secret: string; now?: Date },
): SessionRecoveryAccessTokenValidationResult {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid_format' };
  }

  const [prefix, payloadB64, signature] = parts;
  if (prefix !== TOKEN_PREFIX) {
    return { ok: false, reason: 'invalid_prefix' };
  }

  const decoded = base64UrlDecode(payloadB64);
  if (!decoded) {
    return { ok: false, reason: 'invalid_payload' };
  }

  let parsedPayload: SessionRecoveryAccessTokenPayload;
  try {
    parsedPayload = payloadSchema.parse(JSON.parse(decoded));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  const expectedSignature = computeSignature(params.secret, payloadB64);
  if (!safeEqual(signature, expectedSignature)) {
    return {
      ok: false,
      reason: 'invalid_signature',
      restaurantId: parsedPayload.restaurantId,
    };
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
