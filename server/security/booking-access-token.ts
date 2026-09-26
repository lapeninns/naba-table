import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { normalizeEmail, normalizePhone } from '@/server/customers';
import { openAeadToken, sealAeadToken } from '@/server/security/aead-token';

/**
 * `bk1` booking access capability.
 *
 * A bk1 token grants guest access to exactly one booking (`bid`) at one
 * restaurant (`rid`). It also carries `cfp`, a keyed fingerprint of the
 * booking's contact details at issue time: every use recomputes it from the
 * current row, so changing the booking's email or phone revokes every link and
 * cookie minted before the change. Rotating the secret revokes everything.
 *
 * Format: `bk1.<iv>.<ciphertext>.<tag>` (AES-256-GCM, see aead-token.ts).
 */

export const BOOKING_ACCESS_TOKEN_PREFIX = 'bk1' as const;
const KEY_LABEL = 'booking-access-token';
const FINGERPRINT_KEY_LABEL = 'booking-access-cfp';
const FINGERPRINT_LENGTH = 22; // 16 bytes, base64url, unpadded

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/** A link must stay usable for at least this long, even for a past booking. */
export const BOOKING_ACCESS_LINK_MIN_SECONDS = HOUR_SECONDS;
/** Links never outlive this, so far-future bookings rely on fresh reminder links. */
export const BOOKING_ACCESS_LINK_MAX_SECONDS = 30 * DAY_SECONDS;
/** Links stay valid this long after the booking ends. */
export const BOOKING_ACCESS_LINK_GRACE_SECONDS = DAY_SECONDS;
/** Cookie minted when a link is redeemed at /bookings/recover. */
export const BOOKING_ACCESS_REDEEM_MAX_SECONDS = 14 * DAY_SECONDS;
/** Cookie minted for the guest who just created the booking. */
export const BOOKING_ACCESS_CREATOR_MAX_SECONDS = DAY_SECONDS;
/** Assumed duration when a booking has a start instant but no end instant. */
const FALLBACK_DURATION_SECONDS = 4 * HOUR_SECONDS;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const bookingAccessSourceSchema = z.enum(['create', 'link', 'redeem']);
export type BookingAccessSource = z.infer<typeof bookingAccessSourceSchema>;

const payloadSchema = z
  .object({
    v: z.literal(1),
    bid: z.string().regex(UUID_PATTERN),
    rid: z.string().regex(UUID_PATTERN),
    cfp: z.string().length(FINGERPRINT_LENGTH),
    src: bookingAccessSourceSchema,
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .strict();

export type BookingAccessTokenPayload = z.infer<typeof payloadSchema>;

export type BookingAccessTokenValidationError =
  | 'invalid_format'
  | 'invalid_prefix'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'expired';

export type BookingAccessTokenValidationResult =
  | { ok: true; payload: BookingAccessTokenPayload }
  | { ok: false; reason: BookingAccessTokenValidationError };

export type BookingAccessTokenMatch = 'ok' | 'wrong_booking' | 'revoked';

/** The booking columns the token logic reads. */
export type BookingAccessBooking = {
  id: string;
  restaurant_id: string | null | undefined;
  customer_email: string | null | undefined;
  customer_phone: string | null | undefined;
  start_at?: string | null;
  end_at?: string | null;
  booking_date?: string | null;
};

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function normalizePhoneSafely(value: string | null | undefined): string {
  try {
    return normalizePhone(value) || '';
  } catch {
    return '';
  }
}

/**
 * Keyed contact fingerprint. `null` when the booking has neither an email nor a
 * phone number (walk-ins): such bookings cannot hold a capability.
 */
export function computeBookingContactFingerprint(
  email: string | null | undefined,
  phone: string | null | undefined,
  secret: string,
): string | null {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhoneSafely(phone);
  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  const key = createHash('sha256').update(`${FINGERPRINT_KEY_LABEL}:${secret}`).digest();
  return createHmac('sha256', key)
    .update(`${normalizedEmail}\n${normalizedPhone}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}

function parseInstantSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * When the booking is over: `end_at`, else `start_at + 4h`, else the end of
 * `booking_date` (23:59 UTC). `null` when none are known.
 */
export function resolveBookingAccessEndSeconds(booking: BookingAccessBooking): number | null {
  const endAt = parseInstantSeconds(booking.end_at);
  if (endAt !== null) return endAt;

  const startAt = parseInstantSeconds(booking.start_at);
  if (startAt !== null) return startAt + FALLBACK_DURATION_SECONDS;

  if (booking.booking_date && DATE_PATTERN.test(booking.booking_date)) {
    return parseInstantSeconds(`${booking.booking_date}T23:59:00.000Z`);
  }

  return null;
}

/** Link expiry: `clamp(endAt + 24h, iat + 1h, iat + 30d)`. */
export function computeBookingLinkExpirySeconds(
  booking: BookingAccessBooking,
  issuedAtSeconds: number,
): number {
  const minExp = issuedAtSeconds + BOOKING_ACCESS_LINK_MIN_SECONDS;
  const maxExp = issuedAtSeconds + BOOKING_ACCESS_LINK_MAX_SECONDS;
  const endAt = resolveBookingAccessEndSeconds(booking);
  if (endAt === null) {
    return minExp;
  }
  return Math.min(maxExp, Math.max(minExp, endAt + BOOKING_ACCESS_LINK_GRACE_SECONDS));
}

function computeExpirySeconds(params: {
  booking: BookingAccessBooking;
  source: BookingAccessSource;
  issuedAtSeconds: number;
  notAfterSeconds: number | null;
}): number {
  const linkExp = computeBookingLinkExpirySeconds(params.booking, params.issuedAtSeconds);
  switch (params.source) {
    case 'link':
      return linkExp;
    case 'create':
      return Math.min(linkExp, params.issuedAtSeconds + BOOKING_ACCESS_CREATOR_MAX_SECONDS);
    case 'redeem':
      return Math.min(
        params.notAfterSeconds ?? linkExp,
        params.issuedAtSeconds + BOOKING_ACCESS_REDEEM_MAX_SECONDS,
      );
    default: {
      const exhaustive: never = params.source;
      throw new Error(`Unknown booking access source: ${String(exhaustive)}`);
    }
  }
}

/**
 * Mints a bk1 token for one booking. Returns `null` when the booking cannot
 * hold a capability: a non-uuid id (email previews), no restaurant, or no
 * contact details.
 *
 * `notAfter` caps a redeem token at the expiry of the link that was redeemed.
 */
export function createBookingAccessToken(params: {
  booking: BookingAccessBooking;
  secret: string;
  source: BookingAccessSource;
  now?: Date;
  notAfter?: Date | null;
}): { token: string; expiresAt: Date } | null {
  const { booking, secret, source } = params;
  if (!secret || !isUuid(booking.id) || !isUuid(booking.restaurant_id)) {
    return null;
  }

  const cfp = computeBookingContactFingerprint(
    booking.customer_email,
    booking.customer_phone,
    secret,
  );
  if (!cfp) {
    return null;
  }

  const issuedAtSeconds = Math.floor((params.now?.getTime() ?? Date.now()) / 1000);
  const notAfterSeconds = params.notAfter ? Math.floor(params.notAfter.getTime() / 1000) : null;
  const exp = computeExpirySeconds({ booking, source, issuedAtSeconds, notAfterSeconds });
  if (exp <= issuedAtSeconds) {
    return null;
  }

  const payload = payloadSchema.parse({
    v: 1,
    bid: booking.id.toLowerCase(),
    rid: booking.restaurant_id.toLowerCase(),
    cfp,
    src: source,
    iat: issuedAtSeconds,
    exp,
  } satisfies BookingAccessTokenPayload);

  const token = sealAeadToken({
    prefix: BOOKING_ACCESS_TOKEN_PREFIX,
    keyLabel: KEY_LABEL,
    secret,
    plaintext: JSON.stringify(payload),
  });

  return { token, expiresAt: new Date(exp * 1000) };
}

export function validateBookingAccessToken(
  token: string,
  params: { secret: string; now?: Date },
): BookingAccessTokenValidationResult {
  const opened = openAeadToken(token, {
    prefix: BOOKING_ACCESS_TOKEN_PREFIX,
    keyLabel: KEY_LABEL,
    secret: params.secret,
  });
  if (!opened.ok) {
    return { ok: false, reason: opened.reason };
  }

  let payload: BookingAccessTokenPayload;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(opened.plaintext));
    if (!parsed.success) {
      return { ok: false, reason: 'invalid_payload' };
    }
    payload = parsed.data;
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  const nowSeconds = Math.floor((params.now?.getTime() ?? Date.now()) / 1000);
  if (nowSeconds > payload.exp) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Binds a validated payload to the current booking row: same booking, same
 * restaurant, and the contact fingerprint recomputed from the row matches.
 */
export function bookingAccessTokenMatchesBooking(
  payload: BookingAccessTokenPayload,
  booking: Pick<BookingAccessBooking, 'id' | 'restaurant_id' | 'customer_email' | 'customer_phone'>,
  secret: string,
): BookingAccessTokenMatch {
  if (
    payload.bid !== booking.id.toLowerCase() ||
    !booking.restaurant_id ||
    payload.rid !== booking.restaurant_id.toLowerCase()
  ) {
    return 'wrong_booking';
  }

  const current = computeBookingContactFingerprint(
    booking.customer_email,
    booking.customer_phone,
    secret,
  );
  if (!current || !constantTimeEquals(current, payload.cfp)) {
    return 'revoked';
  }

  return 'ok';
}

/** Retired contact-scoped `sr2.` session recovery tokens. */
export function isLegacySessionRecoveryToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith('sr2.');
}
