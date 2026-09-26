import { NextResponse, type NextRequest } from 'next/server';

import { apiError, internalError, notFound, unauthenticated } from '@/lib/api/errors';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { listBookingHistory } from '@/server/ops/booking-lifecycle/history';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { Tables } from '@/types/supabase';

const ROUTE = '/api/ops/bookings/[id]/history';

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

async function resolveBookingId(
  paramsPromise: Promise<{ id: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return apiError(400, 'BOOKING_ID_REQUIRED', 'Missing booking id');
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logger.error('[ops][booking-history] failed to resolve auth', {
      route: ROUTE,
      errorMessage: sanitizeLogText(authError.message),
    });
    return unauthenticated('Unable to verify session');
  }

  if (!user) {
    return unauthenticated('Authentication required');
  }

  let authorizedRestaurantIds: string[];
  try {
    const memberships = await fetchUserMemberships(user.id, supabase);
    authorizedRestaurantIds = memberships
      .map((membership) => membership.restaurant_id)
      .filter(
        (restaurantId): restaurantId is string =>
          typeof restaurantId === 'string' && restaurantId.length > 0,
      );
  } catch (membershipError) {
    captureServerException(membershipError, {
      distinctId: user.id,
      properties: { bookingId: id, source: 'ops', kind: 'ops-booking-history' },
    });
    return internalError(membershipError, { route: ROUTE }, 'Unable to verify access');
  }

  if (authorizedRestaurantIds.length === 0) {
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: booking, error: bookingError } = await serviceSupabase
    .from('bookings')
    .select('id, restaurant_id')
    .eq('id', id)
    .in('restaurant_id', authorizedRestaurantIds)
    .maybeSingle();

  if (bookingError) {
    return internalError(
      bookingError,
      { route: ROUTE, stage: 'booking_lookup' },
      'Unable to load booking',
    );
  }

  const bookingRow = booking as Pick<Tables<'bookings'>, 'id' | 'restaurant_id'> | null;
  if (!bookingRow) {
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  try {
    const history = await listBookingHistory(bookingRow.id);
    return NextResponse.json({
      bookingId: bookingRow.id,
      entries: history,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: bookingRow.restaurant_id },
      properties: {
        bookingId: bookingRow.id,
        restaurantId: bookingRow.restaurant_id,
        source: 'ops',
        kind: 'ops-booking-history',
      },
    });
    return internalError(error, { route: ROUTE }, 'Unable to load booking history');
  }
}
