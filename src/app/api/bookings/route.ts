import { env } from '@/lib/env';
import { buildBookingsGetHttpResponse } from '@/server/bookings/bookings-get-response';
import {
  buildBookingCreateInvalidJsonResponse,
  buildBookingsPostHttpResponse,
} from '@/server/bookings/bookings-post-response';
import {
  getBookingPastTimeGraceMinutes,
  getInlineAutoAssignTimeoutMs,
  isAutoAssignOnBookingEnabled,
  isBookingPastTimeBlockingEnabled,
  isUnifiedBookingValidationEnabled,
} from '@/server/runtime-policy';
import { extractClientIp } from '@/server/security/request';

import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return await buildBookingsGetHttpResponse({
    searchParams: req.nextUrl.searchParams,
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
    accessSecret: env.security.sessionRecoveryAccessTokenSecret,
    autoAssignEnabled: isAutoAssignOnBookingEnabled(),
    bookingPastTimeBlocking: isBookingPastTimeBlockingEnabled(),
    bookingPastTimeGraceMinutes: getBookingPastTimeGraceMinutes(),
    bookingValidationUnified: isUnifiedBookingValidationEnabled(),
    clientIp: extractClientIp(req),
    cookieRequest: req,
    headers: req.headers,
    inlineAutoAssignTimeoutMs: getInlineAutoAssignTimeoutMs(),
    payload,
  });
}
