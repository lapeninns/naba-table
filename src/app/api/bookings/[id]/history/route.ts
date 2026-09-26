import { z } from 'zod';

import { apiError, internalError, validationError } from '@/lib/api/errors';
import { firstString } from '@/lib/api/query-params';
import { captureServerException } from '@/lib/posthog/server';
import { getBookingHistory } from '@/server/bookingHistory';
import {
  finalizeGuestAccessResponse,
  guestAccessJson,
  resolveGuestBookingAccess,
} from '@/server/bookings/guest-booking-access';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const bookingIdSchema = z.string().uuid();

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

async function resolveBookingId(
  paramsPromise?: Promise<{ id: string | string[] }>,
): Promise<string | null> {
  if (!paramsPromise) {
    return null;
  }

  const { id } = await paramsPromise;
  const candidate = Array.isArray(id) ? id[0] : id;
  const parsed = bookingIdSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * GET /api/bookings/[id]/history
 *
 * Guest booking history. Access goes through the same booking-scoped resolver
 * as GET /api/bookings/[id]: the booking's access cookie, or a session that
 * owns the booking.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return apiError(400, 'MISSING_BOOKING_ID', 'Missing booking id.');
  }

  const parsedQuery = querySchema.safeParse({
    limit: firstString(req.nextUrl.searchParams, 'limit'),
    offset: firstString(req.nextUrl.searchParams, 'offset'),
  });

  if (!parsedQuery.success) {
    return validationError(parsedQuery.error, 'Invalid query parameters.');
  }

  const resolution = await resolveGuestBookingAccess(req, bookingId, { op: 'read' });
  if (!resolution.ok) {
    return resolution.response;
  }

  try {
    const events = await getBookingHistory(getServiceSupabaseClient(), bookingId, parsedQuery.data);

    return guestAccessJson(
      req,
      bookingId,
      resolution,
      {
        events,
        pagination: {
          limit: parsedQuery.data.limit ?? 50,
          offset: parsedQuery.data.offset ?? 0,
          count: events.length,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    captureServerException(error, {
      ...(resolution.access.kind === 'session' ? { distinctId: resolution.access.userId } : {}),
      groups: { restaurant: resolution.booking.restaurant_id },
      properties: {
        bookingId,
        restaurantId: resolution.booking.restaurant_id,
        source: 'api',
        kind: 'booking-history',
      },
    });
    return finalizeGuestAccessResponse(
      req,
      internalError(error, { route: 'bookings.[id].history.GET', bookingId }),
      { bookingId, clearCookie: resolution.clearCookie },
    );
  }
}

export const dynamic = 'force-dynamic';
