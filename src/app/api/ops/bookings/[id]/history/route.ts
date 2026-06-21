import { NextResponse, type NextRequest } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';

import { listBookingHistory } from '@/server/ops/booking-lifecycle/history';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { Tables } from '@/types/supabase';

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
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops][booking-history] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
    console.error('[ops][booking-history] failed to load memberships', membershipError);
    captureServerException(membershipError, {
      distinctId: user.id,
      properties: { bookingId: id, source: 'ops', kind: 'ops-booking-history' },
    });
    return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 });
  }

  if (authorizedRestaurantIds.length === 0) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: booking, error: bookingError } = await serviceSupabase
    .from('bookings')
    .select('id, restaurant_id')
    .eq('id', id)
    .in('restaurant_id', authorizedRestaurantIds)
    .maybeSingle();

  if (bookingError) {
    console.error('[ops][booking-history] failed to load booking', bookingError.message);
    return NextResponse.json({ error: 'Unable to load booking' }, { status: 500 });
  }

  const bookingRow = booking as Pick<Tables<'bookings'>, 'id' | 'restaurant_id'> | null;
  if (!bookingRow) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  try {
    const history = await listBookingHistory(bookingRow.id);
    return NextResponse.json({
      bookingId: bookingRow.id,
      entries: history,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ops][booking-history] failed to fetch history', error);
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
    return NextResponse.json({ error: 'Unable to load booking history' }, { status: 500 });
  }
}
