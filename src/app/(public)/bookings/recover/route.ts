import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  claimBookingForUser,
  clearLegacyGuestCookies,
  mintBookingAccessGrant,
  setBookingAccessCookie,
  type GuestBookingRow,
} from '@/server/bookings/guest-booking-access';
import {
  bookingAccessTokenMatchesBooking,
  isLegacySessionRecoveryToken,
  validateBookingAccessToken,
} from '@/server/security/booking-access-token';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp, extractClientIp } from '@/server/security/request';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const RECOVER_LIMIT = { limit: 30, windowMs: 60_000 } as const;

type RecoverErrorCode =
  | 'RATE_LIMITED'
  | 'MISSING_ACCESS_TOKEN'
  | 'LEGACY_TOKEN_DEPRECATED'
  | 'LEGACY_LINK_EXPIRED'
  | 'ACCESS_TOKEN_NOT_CONFIGURED'
  | 'ACCESS_TOKEN_EXPIRED'
  | 'INVALID_ACCESS_TOKEN'
  | 'ACCESS_TOKEN_REVOKED';

function withRedirectHeaders(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

/** Error redirects carry only a reason code, never the token. */
function errorRedirect(req: NextRequest, code: RecoverErrorCode): NextResponse {
  const errorUrl = new URL('/bookings/recover/error', req.nextUrl.origin);
  errorUrl.searchParams.set('code', code);
  return withRedirectHeaders(NextResponse.redirect(errorUrl, { status: 303 }));
}

/**
 * Only the booking's own pages are valid destinations; anything else (other
 * bookings, other paths, other origins) falls back to `/bookings/<bid>`.
 */
function resolveRecoverDestination(next: string | null, bookingId: string): string {
  const allowed = [
    `/bookings/${bookingId}`,
    `/guest/bookings/${bookingId}`,
    `/guest/bookings/${bookingId}/receipt`,
  ];
  return next && allowed.includes(next) ? next : `/bookings/${bookingId}`;
}

async function getSessionUser() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /bookings/recover?access_token=<bk1>[&next=/bookings/<id>]
 *
 * Redeems an emailed/SMS booking link: validates the link token against the
 * current booking row, mints a fresh, shorter-lived `redeem` token into the
 * booking's `__Host-nt_bk.<id>` cookie, binds the booking to a signed-in user
 * with the same email (claim), and redirects (303) to the booking page with
 * no token in the URL.
 */
export async function GET(req: NextRequest) {
  try {
    const limit = await consumeRateLimit({
      identifier: `bookings:recover:${anonymizeIp(extractClientIp(req))}`,
      limit: RECOVER_LIMIT.limit,
      windowMs: RECOVER_LIMIT.windowMs,
    });
    if (!limit.ok) {
      return errorRedirect(req, 'RATE_LIMITED');
    }
  } catch {
    return errorRedirect(req, 'RATE_LIMITED');
  }

  const params = req.nextUrl.searchParams;
  const accessToken = params.get('access_token') ?? params.get('accessToken');
  if (!accessToken) {
    return errorRedirect(
      req,
      params.get('token') ? 'LEGACY_TOKEN_DEPRECATED' : 'MISSING_ACCESS_TOKEN',
    );
  }
  if (isLegacySessionRecoveryToken(accessToken)) {
    return errorRedirect(req, 'LEGACY_LINK_EXPIRED');
  }

  const secret = env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) {
    return errorRedirect(req, 'ACCESS_TOKEN_NOT_CONFIGURED');
  }

  const now = new Date();
  const validated = validateBookingAccessToken(accessToken, { secret, now });
  if (!validated.ok) {
    return errorRedirect(
      req,
      validated.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN',
    );
  }
  const { payload } = validated;

  const { data, error } = await getServiceSupabaseClient()
    .from('bookings')
    .select('*')
    .eq('id', payload.bid)
    .eq('restaurant_id', payload.rid)
    .maybeSingle();
  if (error) {
    logger.error('bookings.recover.lookup_failed', { bookingId: payload.bid });
    return errorRedirect(req, 'INVALID_ACCESS_TOKEN');
  }
  const booking = (data ?? null) as GuestBookingRow | null;
  if (!booking) {
    return errorRedirect(req, 'INVALID_ACCESS_TOKEN');
  }

  const match = bookingAccessTokenMatchesBooking(payload, booking, secret);
  if (match !== 'ok') {
    return errorRedirect(
      req,
      match === 'revoked' ? 'ACCESS_TOKEN_REVOKED' : 'INVALID_ACCESS_TOKEN',
    );
  }

  const grant = mintBookingAccessGrant({
    booking,
    source: 'redeem',
    secret,
    now,
    notAfter: new Date(payload.exp * 1000),
  });
  if (!grant) {
    return errorRedirect(req, 'INVALID_ACCESS_TOKEN');
  }

  const user = await getSessionUser();
  if (user) {
    await claimBookingForUser({
      booking,
      user: { id: user.id, email: user.email ?? null },
    });
  }

  const destination = resolveRecoverDestination(params.get('next'), booking.id);
  const res = withRedirectHeaders(
    NextResponse.redirect(new URL(destination, req.nextUrl.origin), { status: 303 }),
  );
  setBookingAccessCookie(req, res, grant, { secret, now });
  clearLegacyGuestCookies(res);
  return res;
}
