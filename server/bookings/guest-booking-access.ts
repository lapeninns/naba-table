import { NextResponse } from 'next/server';

import { apiError, rateLimited, unauthenticated } from '@/lib/api/errors';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { normalizeEmail } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';
import {
  bookingAccessTokenMatchesBooking,
  createBookingAccessToken,
  validateBookingAccessToken,
  type BookingAccessBooking,
  type BookingAccessSource,
  type BookingAccessTokenPayload,
} from '@/server/security/booking-access-token';
import { validateCsrfToken } from '@/server/security/csrf';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp, extractClientIp } from '@/server/security/request';
import {
  getRouteHandlerSupabaseClient,
  getServerComponentSupabaseClient,
  getServiceSupabaseClient,
} from '@/server/supabase';

import type { Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

/**
 * Guest booking access (booking-scoped capabilities).
 *
 * A guest reaches one booking through either:
 * - a `bk1` capability in the httpOnly cookie `__Host-nt_bk.<bookingId>`
 *   (minted at create for the creator, or at /bookings/recover from an emailed
 *   link), bound to that booking, its restaurant and its current contact; or
 * - a Supabase session that owns the booking (`bookings.auth_user_id`).
 *
 * Contact details alone never grant anything. Query-string tokens are refused
 * on the API: links are redeemed once at /bookings/recover and never used as a
 * bearer afterwards.
 *
 * Cookies are written as raw `Set-Cookie` headers (several may share a name,
 * e.g. the host-only and Domain-scoped `sr_access` clears). Do not call
 * `res.cookies.set` on a response after applying these helpers: Next's
 * ResponseCookies rewrites the whole Set-Cookie list from its own map.
 */

/**
 * Whether a signed-in user whose confirmed email equals the booking email may
 * read or update it without a claim. Ships `false`: with Supabase
 * `mailer_autoconfirm` on, `email_confirmed_at` proves nothing. Flip only with
 * the recorded read-only auth-config evidence described in the design (§5.2).
 */
export const SESSION_EMAIL_MATCH_ENABLED = false;

export const BOOKING_ACCESS_COOKIE_PREFIX = '__Host-nt_bk.';
export const BOOKING_ACCESS_DEV_COOKIE_PREFIX = 'nt_bk.';
const BOOKING_ACCESS_COOKIE_CAP = 10;
const LEGACY_SESSION_RECOVERY_COOKIE = 'sr_access';
const LEGACY_CONFIRMATION_COOKIE = 'sr_confirm';
const QUERY_STRING_TOKEN_PARAMS = ['access_token', 'accessToken', 'token'] as const;

const TOKEN_READ_LIMIT = { limit: 120, windowMs: 60_000 } as const;
const TOKEN_WRITE_LIMIT = { limit: 10, windowMs: 60_000 } as const;
const SESSION_READ_LIMIT = { limit: 60, windowMs: 60_000 } as const;
const INVALID_TOKEN_LIMIT = { limit: 30, windowMs: 60_000 } as const;

export type GuestBookingOperation = 'read' | 'update' | 'cancel';
export type GuestBookingRow = Tables<'bookings'>;

export type GuestBookingAccess =
  | { kind: 'token'; source: BookingAccessSource }
  | { kind: 'session'; userId: string };

export type GuestSessionUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

type TokenFailureReason =
  | 'not_configured'
  | 'invalid'
  | 'wrong_booking'
  | 'missing'
  | 'expired'
  | 'revoked';

export type GuestBookingAccessResult =
  | {
      ok: true;
      booking: GuestBookingRow;
      access: GuestBookingAccess;
      /** The request's booking cookie failed and must be cleared on the response. */
      clearCookie: boolean;
    }
  | { ok: false; response: NextResponse };

type CookieReader = {
  get(name: string): { value: string } | undefined;
  getAll(): Array<{ name: string; value: string }>;
};

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

type CookieWrite = {
  name: string;
  value: string;
  maxAge: number;
  secure: boolean;
  path?: string;
  domain?: string;
};

function isDevCookieAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function serializeCookie(cookie: CookieWrite): string {
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Path=${cookie.path ?? '/'}`,
    `Max-Age=${Math.max(0, Math.floor(cookie.maxAge))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (cookie.maxAge <= 0) {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }
  if (cookie.domain) {
    parts.push(`Domain=${cookie.domain}`);
  }
  if (cookie.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function appendCookie(res: Response, cookie: CookieWrite): void {
  res.headers.append('Set-Cookie', serializeCookie(cookie));
}

/** True when the request arrived over plain http (local development only). */
function requestIsInsecureHttp(req: Pick<NextRequest, 'headers' | 'nextUrl'>): boolean {
  const forwarded = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const proto = forwarded ?? req.nextUrl.protocol.replace(':', '').toLowerCase();
  return proto === 'http';
}

export function bookingAccessCookieName(bookingId: string, insecureDev = false): string {
  return insecureDev && isDevCookieAllowed()
    ? `${BOOKING_ACCESS_DEV_COOKIE_PREFIX}${bookingId}`
    : `${BOOKING_ACCESS_COOKIE_PREFIX}${bookingId}`;
}

/**
 * Reads the booking's access cookie. The unprefixed development name is only
 * honoured outside production, mirroring where it can be written.
 */
export function readBookingAccessCookie(
  cookies: Pick<CookieReader, 'get'>,
  bookingId: string,
): string | null {
  const secureValue = cookies.get(`${BOOKING_ACCESS_COOKIE_PREFIX}${bookingId}`)?.value;
  if (secureValue) return secureValue;
  if (isDevCookieAllowed()) {
    return cookies.get(`${BOOKING_ACCESS_DEV_COOKIE_PREFIX}${bookingId}`)?.value || null;
  }
  return null;
}

type BookingAccessCookieEntry = { name: string; bookingId: string; value: string };

function listBookingAccessCookies(
  cookies: Pick<CookieReader, 'getAll'>,
): BookingAccessCookieEntry[] {
  const entries: BookingAccessCookieEntry[] = [];
  for (const cookie of cookies.getAll()) {
    if (cookie.name.startsWith(BOOKING_ACCESS_COOKIE_PREFIX)) {
      entries.push({
        name: cookie.name,
        bookingId: cookie.name.slice(BOOKING_ACCESS_COOKIE_PREFIX.length),
        value: cookie.value,
      });
    } else if (isDevCookieAllowed() && cookie.name.startsWith(BOOKING_ACCESS_DEV_COOKIE_PREFIX)) {
      entries.push({
        name: cookie.name,
        bookingId: cookie.name.slice(BOOKING_ACCESS_DEV_COOKIE_PREFIX.length),
        value: cookie.value,
      });
    }
  }
  return entries;
}

function clearCookieByName(res: Response, name: string): void {
  appendCookie(res, {
    name,
    value: '',
    maxAge: 0,
    secure: name.startsWith('__Host-') || !isDevCookieAllowed(),
  });
}

/**
 * Sets the booking's access cookie, keeping at most {@link BOOKING_ACCESS_COOKIE_CAP}
 * booking cookies: undecodable ones are dropped first, then the earliest
 * expiring until the new cookie fits.
 */
export function setBookingAccessCookie(
  req: Pick<NextRequest, 'headers' | 'nextUrl' | 'cookies'>,
  res: Response,
  grant: { bookingId: string; token: string; expiresAt: Date },
  options: { secret: string; now?: Date },
): void {
  const now = options.now ?? new Date();
  const kept: Array<BookingAccessCookieEntry & { exp: number }> = [];

  for (const entry of listBookingAccessCookies(req.cookies)) {
    if (entry.bookingId === grant.bookingId) {
      continue; // replaced below
    }
    const result = validateBookingAccessToken(entry.value, { secret: options.secret, now });
    if (!result.ok || result.payload.bid !== entry.bookingId.toLowerCase()) {
      clearCookieByName(res, entry.name);
      continue;
    }
    kept.push({ ...entry, exp: result.payload.exp });
  }

  kept.sort((a, b) => a.exp - b.exp);
  while (kept.length >= BOOKING_ACCESS_COOKIE_CAP) {
    const evicted = kept.shift();
    if (evicted) clearCookieByName(res, evicted.name);
  }

  const insecureDev = requestIsInsecureHttp(req) && isDevCookieAllowed();
  appendCookie(res, {
    name: bookingAccessCookieName(grant.bookingId, insecureDev),
    value: grant.token,
    maxAge: Math.max(1, Math.floor((grant.expiresAt.getTime() - now.getTime()) / 1000)),
    secure: !insecureDev,
  });
}

/** Clears one booking's access cookie (both the secure and the development name). */
export function clearBookingAccessCookie(res: Response, bookingId: string): void {
  clearCookieByName(res, `${BOOKING_ACCESS_COOKIE_PREFIX}${bookingId}`);
  if (isDevCookieAllowed()) {
    clearCookieByName(res, `${BOOKING_ACCESS_DEV_COOKIE_PREFIX}${bookingId}`);
  }
}

function normalizeRootDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^https?:\/\//, '');
  const withoutPath = withoutScheme.split('/')[0] ?? '';
  const withoutPort = withoutPath.replace(/:\d+$/, '');
  return withoutPort.replace(/^\.+/, '').replace(/^www\./, '');
}

/**
 * Clears the retired contact-scoped `sr_access` cookie (host-only and the old
 * `Domain=.<root>` variant) and the retired `sr_confirm` cookie.
 */
export function clearLegacyGuestCookies(
  res: Response,
  rootDomain: string = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost',
): void {
  const secure = !isDevCookieAllowed();
  appendCookie(res, { name: LEGACY_SESSION_RECOVERY_COOKIE, value: '', maxAge: 0, secure });
  const root = normalizeRootDomain(rootDomain);
  if (root && root !== 'localhost') {
    appendCookie(res, {
      name: LEGACY_SESSION_RECOVERY_COOKIE,
      value: '',
      maxAge: 0,
      secure,
      domain: `.${root}`,
    });
  }
  appendCookie(res, {
    name: LEGACY_CONFIRMATION_COOKIE,
    value: '',
    maxAge: 0,
    secure,
    path: '/api/bookings/confirm',
  });
}

function hasLegacyGuestCookies(cookies: Pick<CookieReader, 'get'>): boolean {
  return Boolean(
    cookies.get(LEGACY_SESSION_RECOVERY_COOKIE)?.value ||
    cookies.get(LEGACY_CONFIRMATION_COOKIE)?.value,
  );
}

/**
 * Applies the cookie side effects of an access decision to a response: clears
 * a failed booking cookie, and clears the retired `sr_access`/`sr_confirm`
 * cookies whenever the request still carries them.
 */
export function finalizeGuestAccessResponse<T extends Response>(
  req: Pick<NextRequest, 'cookies'>,
  res: T,
  params: { bookingId: string; clearCookie: boolean },
): T {
  if (params.clearCookie) {
    clearBookingAccessCookie(res, params.bookingId);
  }
  if (hasLegacyGuestCookies(req.cookies)) {
    clearLegacyGuestCookies(res);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/**
 * Session ownership. `auth_user_id` binding always counts. Email match counts
 * only when explicitly enabled, the email is confirmed, and the operation is
 * not a cancellation.
 */
export function isVerifiedBookingOwner(
  booking: Pick<GuestBookingRow, 'auth_user_id' | 'customer_email'>,
  user: GuestSessionUser,
  op: GuestBookingOperation,
  emailMatchEnabled: boolean = SESSION_EMAIL_MATCH_ENABLED,
): boolean {
  if (booking.auth_user_id && booking.auth_user_id === user.id) {
    return true;
  }
  if (op === 'cancel' || !emailMatchEnabled || !user.email_confirmed_at) {
    return false;
  }
  const userEmail = normalizeEmail(user.email);
  const bookingEmail = normalizeEmail(booking.customer_email);
  return userEmail.length > 0 && userEmail === bookingEmail;
}

// ---------------------------------------------------------------------------
// Request guards
// ---------------------------------------------------------------------------

/** Booking tokens are never accepted from the URL on the API. */
function rejectQueryStringToken(req: Pick<NextRequest, 'nextUrl'>): NextResponse | null {
  for (const param of QUERY_STRING_TOKEN_PARAMS) {
    if (req.nextUrl.searchParams.has(param)) {
      return apiError(
        400,
        'ACCESS_TOKEN_IN_URL_REJECTED',
        'Open your booking link in the browser to manage this booking.',
      );
    }
  }
  return null;
}

const FAILURE_RESPONSES: Record<
  Exclude<TokenFailureReason, 'wrong_booking' | 'missing'>,
  { status: number; code: string; message: string }
> = {
  not_configured: {
    status: 503,
    code: 'ACCESS_TOKEN_NOT_CONFIGURED',
    message: 'Booking links are temporarily unavailable. Try again later.',
  },
  invalid: {
    status: 401,
    code: 'INVALID_ACCESS_TOKEN',
    message: 'This booking link is not valid. Request a new link.',
  },
  expired: {
    status: 410,
    code: 'ACCESS_TOKEN_EXPIRED',
    message: 'This booking link has expired. Request a new link.',
  },
  revoked: {
    status: 410,
    code: 'ACCESS_TOKEN_REVOKED',
    message: 'This booking link is no longer valid. Request a new link.',
  },
};

function tokenFailureResponse(reason: TokenFailureReason): NextResponse {
  const key = reason === 'wrong_booking' || reason === 'missing' ? 'invalid' : reason;
  const failure = FAILURE_RESPONSES[key];
  return apiError(failure.status, failure.code, failure.message);
}

function bookingNotFoundResponse(): NextResponse {
  return apiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
}

function guestUnauthenticatedResponse(): NextResponse {
  return unauthenticated(
    'Open the link from your booking email, or sign in to manage this booking.',
  );
}

function recordAccessDenied(params: {
  reason: string;
  mode: 'read' | 'write';
  bookingId: string;
  restaurantId?: string | null;
}): void {
  void recordObservabilityEvent({
    source: 'api.bookings',
    eventType: 'booking_access.denied',
    severity: 'warning',
    context: {
      reason: params.reason,
      mode: params.mode,
      bookingId: params.bookingId,
      restaurantId: params.restaurantId ?? null,
    },
    restaurantId: params.restaurantId ?? null,
    bookingId: params.bookingId,
  });
}

async function consumeBookingScopedLimit(
  bookingId: string,
  mode: 'read' | 'write',
): Promise<NextResponse | null> {
  const bucket = mode === 'read' ? TOKEN_READ_LIMIT : TOKEN_WRITE_LIMIT;
  const scope = mode === 'read' ? 'guest-token-read' : 'guest-token-write';
  try {
    const result = await consumeRateLimit({
      identifier: `bookings:${scope}:${bookingId}`,
      limit: bucket.limit,
      windowMs: bucket.windowMs,
    });
    if (result.ok) return null;
    return rateLimited(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  } catch (error) {
    logger.error('bookings.guest_access.rate_limit_unavailable', {
      bookingId,
      mode,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return apiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Service temporarily unavailable. Try again.', {
      retryable: true,
    });
  }
}

async function consumeSessionReadLimit(userId: string): Promise<NextResponse | null> {
  try {
    const result = await consumeRateLimit({
      identifier: `bookings:session-read:${userId}`,
      limit: SESSION_READ_LIMIT.limit,
      windowMs: SESSION_READ_LIMIT.windowMs,
    });
    if (result.ok) return null;
    return rateLimited(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  } catch {
    return apiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Service temporarily unavailable. Try again.', {
      retryable: true,
    });
  }
}

type TokenCheck =
  | { ok: true; booking: GuestBookingRow; source: BookingAccessSource }
  | { ok: false; reason: TokenFailureReason; restaurantId?: string | null };

type DecodedBookingToken =
  | { ok: true; payload: BookingAccessTokenPayload; secret: string }
  | { ok: false; reason: TokenFailureReason; restaurantId?: string | null };

/**
 * CPU-only checks of a booking cookie value: decrypts it and binds it to
 * `bookingId`. Only a token that passes here can have been minted by us for
 * this booking, so only such a token may consume the per-booking bucket.
 */
function decodeBookingToken(token: string, bookingId: string, now: Date): DecodedBookingToken {
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) {
    return { ok: false, reason: 'not_configured' };
  }

  const validated = validateBookingAccessToken(token, { secret, now });
  if (!validated.ok) {
    return { ok: false, reason: validated.reason === 'expired' ? 'expired' : 'invalid' };
  }
  if (validated.payload.bid !== bookingId.toLowerCase()) {
    return { ok: false, reason: 'wrong_booking', restaurantId: validated.payload.rid };
  }
  return { ok: true, payload: validated.payload, secret };
}

/**
 * Loads `bookingId` with the token's restaurant id and checks the contact
 * fingerprint of a token that already passed {@link decodeBookingToken}.
 */
async function matchDecodedBookingToken(
  decoded: Extract<DecodedBookingToken, { ok: true }>,
  bookingId: string,
): Promise<TokenCheck | { ok: 'error'; error: unknown }> {
  const { data, error } = await getServiceSupabaseClient()
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('restaurant_id', decoded.payload.rid)
    .maybeSingle();
  if (error) {
    return { ok: 'error', error };
  }
  if (!data) {
    return { ok: false, reason: 'missing', restaurantId: decoded.payload.rid };
  }

  const booking = data as GuestBookingRow;
  const match = bookingAccessTokenMatchesBooking(decoded.payload, booking, decoded.secret);
  if (match !== 'ok') {
    return {
      ok: false,
      reason: match === 'revoked' ? 'revoked' : 'wrong_booking',
      restaurantId: booking.restaurant_id,
    };
  }

  return { ok: true, booking, source: decoded.payload.src };
}

/** Full check for server components (no rate limiting there). */
async function checkBookingToken(
  token: string,
  bookingId: string,
  now: Date,
): Promise<TokenCheck | { ok: 'error'; error: unknown }> {
  const decoded = decodeBookingToken(token, bookingId, now);
  if (!decoded.ok) return decoded;
  return matchDecodedBookingToken(decoded, bookingId);
}

/**
 * Cookies that do not decrypt for this booking are charged to the caller's
 * IP, never to the booking: anyone can send `__Host-nt_bk.<id>=x`, and a
 * per-booking charge would let them lock the real link holder out.
 */
async function consumeInvalidTokenLimit(req: NextRequest): Promise<NextResponse | null> {
  try {
    const result = await consumeRateLimit({
      identifier: `bookings:guest-token-invalid:${anonymizeIp(extractClientIp(req))}`,
      limit: INVALID_TOKEN_LIMIT.limit,
      windowMs: INVALID_TOKEN_LIMIT.windowMs,
    });
    if (result.ok) return null;
    return rateLimited(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  } catch {
    return apiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Service temporarily unavailable. Try again.', {
      retryable: true,
    });
  }
}

async function getRouteSessionUser(): Promise<GuestSessionUser | null> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null, email_confirmed_at: user.email_confirmed_at };
}

/**
 * Resolves guest access to one booking for an API request (§5.1):
 * 1. query-string tokens are rejected;
 * 2. writes need the double-submit CSRF token;
 * 3. the booking cookie, bound to booking, restaurant and current contact.
 *    Only a cookie that decrypts for this booking is rate limited per
 *    booking; any other cookie is charged per IP. Any failure falls through,
 *    with the cookie marked for clearing, to
 * 4. the Supabase session, via {@link isVerifiedBookingOwner}.
 *
 * On success the caller must pass its response through
 * {@link finalizeGuestAccessResponse}. Failure responses are already finalized.
 */
export async function resolveGuestBookingAccess(
  req: NextRequest,
  bookingId: string,
  options: { op: GuestBookingOperation; now?: Date },
): Promise<GuestBookingAccessResult> {
  const mode = options.op === 'read' ? 'read' : 'write';
  const now = options.now ?? new Date();
  const fail = (response: NextResponse, clearCookie: boolean): GuestBookingAccessResult => ({
    ok: false,
    response: finalizeGuestAccessResponse(req, response, { bookingId, clearCookie }),
  });

  const queryTokenResponse = rejectQueryStringToken(req);
  if (queryTokenResponse) {
    recordAccessDenied({ reason: 'query_string_token', mode, bookingId });
    return fail(queryTokenResponse, false);
  }

  if (mode === 'write' && !validateCsrfToken(req)) {
    recordAccessDenied({ reason: 'csrf', mode, bookingId });
    return fail(apiError(403, 'CSRF_INVALID', 'Refresh the page and try again.'), false);
  }

  let tokenFailure: TokenFailureReason | null = null;
  const cookieToken = readBookingAccessCookie(req.cookies, bookingId);

  if (cookieToken) {
    const decoded = decodeBookingToken(cookieToken, bookingId, now);
    let checked: TokenCheck | { ok: 'error'; error: unknown };
    if (decoded.ok) {
      const limited = await consumeBookingScopedLimit(bookingId, mode);
      if (limited) {
        return fail(limited, false);
      }
      checked = await matchDecodedBookingToken(decoded, bookingId);
    } else {
      if (decoded.reason !== 'not_configured') {
        const limited = await consumeInvalidTokenLimit(req);
        if (limited) {
          return fail(limited, true);
        }
      }
      checked = decoded;
    }

    if (checked.ok === 'error') {
      logger.error('bookings.guest_access.lookup_failed', { bookingId, mode });
      return fail(
        apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Try again.'),
        false,
      );
    }
    if (checked.ok) {
      return {
        ok: true,
        booking: checked.booking,
        access: { kind: 'token', source: checked.source },
        clearCookie: false,
      };
    }

    tokenFailure = checked.reason;
    recordAccessDenied({
      reason: `token_${checked.reason}`,
      mode,
      bookingId,
      restaurantId: checked.restaurantId,
    });
  }

  const user = await getRouteSessionUser();
  const clearCookie = tokenFailure !== null && tokenFailure !== 'not_configured';
  if (!user) {
    return fail(
      tokenFailure ? tokenFailureResponse(tokenFailure) : guestUnauthenticatedResponse(),
      clearCookie,
    );
  }

  if (mode === 'read') {
    const limited = await consumeSessionReadLimit(user.id);
    if (limited) {
      return fail(limited, clearCookie);
    }
  }

  const { data, error } = await getServiceSupabaseClient()
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    logger.error('bookings.guest_access.lookup_failed', { bookingId, mode });
    return fail(
      apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Try again.'),
      clearCookie,
    );
  }

  const booking = (data ?? null) as GuestBookingRow | null;
  if (!booking || !isVerifiedBookingOwner(booking, user, options.op)) {
    recordAccessDenied({
      reason: booking ? 'session_not_owner' : 'session_not_found',
      mode,
      bookingId,
      restaurantId: booking?.restaurant_id ?? null,
    });
    return fail(bookingNotFoundResponse(), clearCookie);
  }

  return { ok: true, booking, access: { kind: 'session', userId: user.id }, clearCookie };
}

// ---------------------------------------------------------------------------
// Server components
// ---------------------------------------------------------------------------

export type GuestPageAccessResult =
  | { status: 'ok'; access: GuestBookingAccess }
  | {
      status: 'denied';
      reason:
        | 'unauthenticated'
        | 'not_found'
        | 'expired'
        | 'revoked'
        | 'invalid'
        | 'not_configured';
      /** Whether a Supabase session was present (it did not own the booking). */
      signedIn: boolean;
    };

/**
 * The same decision as {@link resolveGuestBookingAccess} for a server
 * component: full token and fingerprint check, then fall-through to the
 * session. Server components cannot write cookies; the API clears them.
 */
export async function resolveGuestBookingAccessForPage(
  cookies: Pick<CookieReader, 'get'>,
  bookingId: string,
  options: { now?: Date } = {},
): Promise<GuestPageAccessResult> {
  const now = options.now ?? new Date();
  let tokenFailure: TokenFailureReason | null = null;

  const cookieToken = readBookingAccessCookie(cookies, bookingId);
  if (cookieToken) {
    const checked = await checkBookingToken(cookieToken, bookingId, now);
    if (checked.ok === true) {
      return { status: 'ok', access: { kind: 'token', source: checked.source } };
    }
    if (checked.ok === false) {
      tokenFailure = checked.reason;
    }
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await getServiceSupabaseClient()
      .from('bookings')
      .select('id, auth_user_id, customer_email')
      .eq('id', bookingId)
      .maybeSingle();
    const booking = data as Pick<GuestBookingRow, 'auth_user_id' | 'customer_email'> | null;
    if (
      booking &&
      isVerifiedBookingOwner(
        booking,
        { id: user.id, email: user.email ?? null, email_confirmed_at: user.email_confirmed_at },
        'read',
      )
    ) {
      return { status: 'ok', access: { kind: 'session', userId: user.id } };
    }
  }

  if (tokenFailure) {
    const reason =
      tokenFailure === 'wrong_booking' || tokenFailure === 'missing' ? 'invalid' : tokenFailure;
    return { status: 'denied', reason, signedIn: Boolean(user) };
  }

  return {
    status: 'denied',
    reason: user ? 'not_found' : 'unauthenticated',
    signedIn: Boolean(user),
  };
}

// ---------------------------------------------------------------------------
// Issuance (used by /bookings/recover now, and by the create response in S1b)
// ---------------------------------------------------------------------------

export type BookingAccessGrant = { bookingId: string; token: string; expiresAt: Date };

/**
 * Mints a bk1 grant for a booking row. `null` when the booking cannot hold a
 * capability (no contact, non-uuid id) or the secret is not configured.
 */
export function mintBookingAccessGrant(params: {
  booking: BookingAccessBooking;
  source: BookingAccessSource;
  secret?: string | null;
  now?: Date;
  notAfter?: Date | null;
}): BookingAccessGrant | null {
  const secret = params.secret ?? env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) return null;
  const minted = createBookingAccessToken({
    booking: params.booking,
    secret,
    source: params.source,
    now: params.now,
    notAfter: params.notAfter,
  });
  if (!minted) return null;
  return { bookingId: params.booking.id, token: minted.token, expiresAt: minted.expiresAt };
}

// ---------------------------------------------------------------------------
// Claim (§4.4)
// ---------------------------------------------------------------------------

export type ClaimOutcome = 'claimed' | 'skipped' | 'failed';

/**
 * Binds a booking to the signed-in user after a link redeem: only when the
 * booking is unbound and the user's email equals the booking email. The
 * update is conditional on `auth_user_id IS NULL` and the restaurant id, so it
 * never steals a booking already bound to someone else.
 */
export async function claimBookingForUser(params: {
  booking: Pick<GuestBookingRow, 'id' | 'restaurant_id' | 'auth_user_id' | 'customer_email'>;
  user: GuestSessionUser;
}): Promise<ClaimOutcome> {
  const { booking, user } = params;
  if (booking.auth_user_id) return 'skipped';
  const userEmail = normalizeEmail(user.email);
  if (!userEmail || userEmail !== normalizeEmail(booking.customer_email)) return 'skipped';

  try {
    const { error } = await getServiceSupabaseClient()
      .from('bookings')
      .update({ auth_user_id: user.id })
      .eq('id', booking.id)
      .eq('restaurant_id', booking.restaurant_id)
      .is('auth_user_id', null);
    if (error) {
      logger.warn('bookings.guest_access.claim_failed', { bookingId: booking.id });
      return 'failed';
    }
    return 'claimed';
  } catch {
    logger.warn('bookings.guest_access.claim_failed', { bookingId: booking.id });
    return 'failed';
  }
}

/** Convenience for route handlers: a JSON response finalized for the access result. */
export function guestAccessJson<T>(
  req: Pick<NextRequest, 'cookies'>,
  bookingId: string,
  resolution: { clearCookie: boolean },
  body: T,
  init?: ResponseInit,
): NextResponse<T> {
  return finalizeGuestAccessResponse(req, NextResponse.json(body, init), {
    bookingId,
    clearCookie: resolution.clearCookie,
  });
}
