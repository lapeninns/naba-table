import { env } from '@/lib/env';
import { buildBookingsGetHttpResponse } from '@/server/bookings/bookings-get-response';
import {
  buildBookingCreateInvalidJsonResponse,
  buildBookingsPostHttpResponse,
} from '@/server/bookings/bookings-post-response';
import { extractClientIp } from '@/server/security/request';

import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return await buildBookingsGetHttpResponse({
    clientIp: extractClientIp(req),
    cookieAccessToken: req.cookies.get('sr_access')?.value ?? null,
    guestLookupPepper: env.security.guestLookupPepper,
    guestLookupPolicyEnabled: env.featureFlags.guestLookupPolicy,
    headers: req.headers,
    searchParams: req.nextUrl.searchParams,
    sessionRecoverySecret: env.security.sessionRecoveryAccessTokenSecret,
  });
}

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return buildBookingCreateInvalidJsonResponse();
  }

  return await buildBookingsPostHttpResponse({
    autoAssignEnabled: env.featureFlags.autoAssignOnBooking,
    bookingPastTimeBlocking: env.featureFlags.bookingPastTimeBlocking,
    bookingPastTimeGraceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
    bookingValidationUnified: env.featureFlags.bookingValidationUnified,
    clientIp: extractClientIp(req),
    headers: req.headers,
    inlineAutoAssignTimeoutMs: env.featureFlags.inlineAutoAssignTimeoutMs,
    payload,
    recoverySecret: env.security.sessionRecoveryAccessTokenSecret,
    recoveryTtlSeconds: env.security.sessionRecoveryAccessTokenTtlSeconds,
  });
}
