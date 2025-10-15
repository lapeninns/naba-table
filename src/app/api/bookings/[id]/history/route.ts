import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBookingHistory } from '@/server/bookingHistory';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { normalizeEmail } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

async function resolveBookingId(paramsPromise?: Promise<{ id: string | string[] }>): Promise<string | null> {
  if (!paramsPromise) {
    return null;
  }

  const result = await paramsPromise;
  const { id } = result;

  if (typeof id === 'string') {
    return id;
  }

  if (Array.isArray(id)) {
    return id[0] ?? null;
  }

  return null;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(searchParams);

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsedQuery.error.flatten() }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const serviceSupabase = getServiceSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedEmail = normalizeEmail(user.email);

  const { data: bookingRow, error: bookingError } = await serviceSupabase
    .from('bookings')
    .select('id, customer_email, restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error('[bookings][history] failed to load booking', bookingError.message);
    return NextResponse.json({ error: 'Unable to load booking history' }, { status: 500 });
  }

  if (!bookingRow) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (bookingRow.customer_email !== normalizedEmail) {
    // Log unauthorized access attempt
    void recordObservabilityEvent({
      source: 'api.bookings',
      eventType: 'booking_history.access_denied',
      severity: 'warning',
      context: {
        booking_id: bookingId,
        user_email: normalizedEmail,
        booking_email: bookingRow.customer_email,
      },
    });

    return NextResponse.json(
      { error: 'You can only view history for your own reservation', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const events = await getBookingHistory(serviceSupabase, bookingId, parsedQuery.data);

    return NextResponse.json({
      events,
      pagination: {
        limit: parsedQuery.data.limit ?? 50,
        offset: parsedQuery.data.offset ?? 0,
        count: events.length,
      },
    });
  } catch (error) {
    console.error('[bookings][history] unexpected', error);
    return NextResponse.json({ error: 'Unable to fetch booking history' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
