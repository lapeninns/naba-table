import { sealAeadToken } from '@/server/security/aead-token';
import {
  createBookingAccessToken,
  type BookingAccessBooking,
  type BookingAccessSource,
} from '@/server/security/booking-access-token';

/** Matches the `env.security.sessionRecoveryAccessTokenSecret` the route tests mock. */
export const TEST_ACCESS_SECRET = 'test-session-recovery-secret';
export const TEST_CSRF_TOKEN = 'csrf-test-token-0123456789abcdef';

export function mintTestAccessToken(
  booking: BookingAccessBooking,
  options: { source?: BookingAccessSource; now?: Date; secret?: string } = {},
): string {
  const minted = createBookingAccessToken({
    booking,
    secret: options.secret ?? TEST_ACCESS_SECRET,
    source: options.source ?? 'redeem',
    now: options.now,
  });
  if (!minted) {
    throw new Error('Test booking cannot hold an access token');
  }
  return minted.token;
}

export function accessCookie(bookingId: string, token: string): string {
  return `__Host-nt_bk.${bookingId}=${token}`;
}

/**
 * Request headers for a guest call: the given cookies plus, unless disabled,
 * a matching double-submit CSRF cookie and header.
 */
export function guestRequestHeaders(
  options: { cookies?: string[]; csrf?: boolean; extra?: Record<string, string> } = {},
): Record<string, string> {
  const cookies = [...(options.cookies ?? [])];
  const headers: Record<string, string> = { ...(options.extra ?? {}) };
  if (options.csrf !== false) {
    cookies.push(`sr-csrf-token=${TEST_CSRF_TOKEN}`);
    headers['x-csrf-token'] = TEST_CSRF_TOKEN;
  }
  if (cookies.length > 0) {
    headers.cookie = cookies.join('; ');
  }
  return headers;
}

export function guestTokenHeaders(
  booking: BookingAccessBooking,
  options: { csrf?: boolean; now?: Date } = {},
): Record<string, string> {
  return guestRequestHeaders({
    cookies: [accessCookie(booking.id, mintTestAccessToken(booking, { now: options.now }))],
    csrf: options.csrf,
  });
}

/**
 * A genuine retired `sr2` session-recovery token (contact-scoped, pre-bk1), sealed exactly
 * as the deleted `server/security/session-recovery-access-token.ts` did: AES-256-GCM, key
 * `sha256("session-recovery-access-token:" + secret)`, AAD `sr2`. Tests use it to prove the
 * retired format grants nothing anywhere.
 */
export function mintLegacySessionRecoveryToken(params: {
  restaurantId: string;
  email?: string | null;
  phone?: string | null;
  secret?: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const issuedAt = Math.floor((params.now?.getTime() ?? Date.now()) / 1000);
  return sealAeadToken({
    prefix: 'sr2',
    keyLabel: 'session-recovery-access-token',
    secret: params.secret ?? TEST_ACCESS_SECRET,
    plaintext: JSON.stringify({
      v: 1,
      purpose: 'session_recovery',
      restaurantId: params.restaurantId,
      email: params.email?.trim().toLowerCase() || null,
      phone: params.phone ?? null,
      iat: issuedAt,
      exp: issuedAt + (params.ttlSeconds ?? 900),
    }),
  });
}
