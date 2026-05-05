import { NextResponse } from 'next/server';
import { z } from 'zod';

import { firstString } from '@/lib/api/query-params';
import { env } from '@/lib/env';
import { getBookingHistory } from '@/server/bookingHistory';
import { normalizeEmail } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import {
  sessionRecoveryTokenMatchesBookingContact,
  validateSessionRecoveryAccessToken,
} from '@/server/security/session-recovery-access-token';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

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

function extractSessionRecoveryAccessToken(req: NextRequest): string | null {
  return (
    req.headers.get('x-session-recovery-token') ??
    req.nextUrl.searchParams.get('access_token') ??
    req.nextUrl.searchParams.get('accessToken') ??
    req.cookies.get('sr_access')?.value ??
    null
  );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const parsedQuery = querySchema.safeParse({
    limit: firstString(req.nextUrl.searchParams, 'limit'),
    offset: firstString(req.nextUrl.searchParams, 'offset'),
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const serviceSupabase = getServiceSupabaseClient();

  // First, try session recovery token (for guest access via email links)
  const recoveryToken = extractSessionRecoveryAccessToken(req);
  if (recoveryToken) {
    const secret = env.security.sessionRecoveryAccessTokenSecret;
    if (!secret) {
      return NextResponse.json(
        { error: 'Session recovery token not configured', code: 'ACCESS_TOKEN_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const result = validateSessionRecoveryAccessToken(recoveryToken, { secret });
    if (!result.ok) {
      const code = result.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN';
      const status = result.reason === 'expired' ? 410 : 401;
      return NextResponse.json({ error: 'Invalid session recovery token', code }, { status });
    }

    const rateLimit = await requireApiRateLimit({
      request: req,
      scope: 'bookings:history-recovery',
      tenantId: result.payload.restaurantId,
      limit: 20,
      windowMs: 60_000,
      message: 'Too many booking history requests. Please try again later.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    // Fetch the booking to verify ownership
    const { data: bookingRow, error: bookingError } = await serviceSupabase
      .from('bookings')
      .select('id, customer_email, customer_phone, restaurant_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error('[bookings][history] failed to load booking', bookingError.message);
      return NextResponse.json({ error: 'Unable to load booking history' }, { status: 500 });
    }

    if (!bookingRow) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify token matches booking
    const tokenEmail = normalizeEmail(result.payload.email);

    if (
      !sessionRecoveryTokenMatchesBookingContact({
        payload: result.payload,
        booking: {
          restaurantId: bookingRow.restaurant_id,
          email: bookingRow.customer_email,
          phone: bookingRow.customer_phone,
        },
      })
    ) {
      void recordObservabilityEvent({
        source: 'api.bookings',
        eventType: 'booking_history.access_denied',
        severity: 'warning',
        context: {
          booking_id: bookingId,
          token_email: tokenEmail,
          booking_email: bookingRow.customer_email
            ? normalizeEmail(bookingRow.customer_email)
            : null,
          reason: 'token_mismatch',
        },
      });

      return NextResponse.json(
        { error: 'You can only view history for your own reservation', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Token is valid and matches - return history
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

  // Fallback to Supabase auth
  const tenantSupabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedEmail = normalizeEmail(user.email);

  const authenticatedRateLimit = await requireApiRateLimit({
    request: req,
    scope: 'bookings:history-authenticated',
    userId: user.id,
    limit: 60,
    windowMs: 60_000,
    message: 'Too many booking history requests. Please try again later.',
  });
  if (authenticatedRateLimit) {
    return authenticatedRateLimit;
  }

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
      { status: 403 },
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
