import { z } from 'zod';

import { normalizeEmail } from '@/server/customers';
import { openAeadToken, sealAeadToken } from '@/server/security/aead-token';

// Encrypted, authenticated token embedded in the List-Unsubscribe URL/header so the
// public unsubscribe endpoint can suppress ONLY the recipient the email was sent to,
// with no enumeration risk. Uses the shared AES-256-GCM framing in
// server/security/aead-token.ts with its own prefix/purpose/AAD for domain
// separation, so the shared signing secret can never be cross-used between features.
const TOKEN_PREFIX = 'unsub1' as const;
const TOKEN_PURPOSE = 'email_unsubscribe' as const;

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

const KEY_LABEL = 'email-unsubscribe-token';

function encryptPayload(secret: string, payload: UnsubscribeTokenPayload): string {
  return sealAeadToken({
    prefix: TOKEN_PREFIX,
    keyLabel: KEY_LABEL,
    secret,
    plaintext: JSON.stringify(payload),
  });
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
  const ttlSeconds = Math.max(
    60,
    Math.min(params.ttlSeconds ?? DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS),
  );
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
  const opened = openAeadToken(token, {
    prefix: TOKEN_PREFIX,
    keyLabel: KEY_LABEL,
    secret: params.secret,
  });
  if (!opened.ok) {
    return { ok: false, reason: opened.reason };
  }
  const decoded = opened.plaintext;

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
