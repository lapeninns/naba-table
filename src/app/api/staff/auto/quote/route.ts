import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  forbidden,
  internalError,
  notFound,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { quoteTables } from '@/server/capacity/engine';
import { HoldConflictError } from '@/server/capacity/holds';
import { ServiceNotFoundError } from '@/server/capacity/policy';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const quotePayloadSchema = z.object({
  bookingId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  maxTables: z.number().int().min(1).max(5).optional(),
  requireAdjacency: z.boolean().optional(),
  avoidTables: z.array(z.string().uuid()).optional(),
  holdTtlSeconds: z.number().int().min(30).max(600).optional(),
});

export async function POST(req: NextRequest) {
  return withCsrfProtectedMutation(req, () => postStaffAutoQuote(req));
}

async function postStaffAutoQuote(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthenticated('Authentication required');
  }

  const body = await req.json().catch(() => null);
  const parsed = quotePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, 'Invalid request payload');
  }

  const { bookingId, zoneId, maxTables, requireAdjacency, avoidTables, holdTtlSeconds } =
    parsed.data;

  const bookingLookup = await supabase
    .from('bookings')
    .select('id, restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return internalError(
      bookingLookup.error,
      {
        route: '/api/staff/auto/quote',
        stage: 'booking_lookup',
        errorKind: bookingLookup.error.code,
      },
      'Unable to quote tables',
    );
  }

  const bookingRow = bookingLookup.data;
  if (!bookingRow || !bookingRow.restaurant_id) {
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  const membership = await supabase
    .from('restaurant_memberships')
    .select('role')
    .eq('restaurant_id', bookingRow.restaurant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership.error) {
    return internalError(
      membership.error,
      {
        route: '/api/staff/auto/quote',
        stage: 'membership_lookup',
        errorKind: membership.error.code,
      },
      'Unable to quote tables',
    );
  }

  if (!membership.data) {
    return forbidden();
  }

  const rateLimitResponse = await requireApiRateLimit({
    request: req,
    scope: 'staff:auto-quote',
    tenantId: bookingRow.restaurant_id,
    userId: user.id,
    limit: 20,
    windowMs: 60_000,
    message: 'Too many auto-quote requests. Please try again in a moment.',
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  try {
    const result = await quoteTables({
      bookingId,
      zoneId,
      maxTables,
      requireAdjacency,
      avoidTables,
      holdTtlSeconds,
      createdBy: user.id,
      client: serviceClient,
    });

    if (result.reason && !result.hold) {
      return NextResponse.json(
        {
          holdId: null,
          expiresAt: null,
          candidate: null,
          alternates: result.alternates,
          nextTimes: result.nextTimes,
          reason: result.reason,
          skipped: result.skipped ?? [],
          serviceFallback: {
            usedFallback: result.metadata?.usedFallback ?? false,
            fallbackService: result.metadata?.fallbackService ?? null,
          },
        },
        { status: 200 },
      );
    }

    if (!result.hold || !result.candidate) {
      return conflict('QUOTE_FAILED', 'No tables could be held for this booking. Try again.');
    }

    return NextResponse.json({
      holdId: result.hold.id,
      expiresAt: result.hold.expiresAt,
      window: {
        start: result.hold.startAt,
        end: result.hold.endAt,
      },
      candidate: result.candidate,
      alternates: result.alternates,
      nextTimes: result.nextTimes,
      zoneId: result.hold.zoneId,
      requireAdjacency: requireAdjacency ?? null,
      skipped: result.skipped ?? [],
      serviceFallback: {
        usedFallback: result.metadata?.usedFallback ?? false,
        fallbackService: result.metadata?.fallbackService ?? null,
      },
    });
  } catch (error) {
    if (error instanceof HoldConflictError) {
      return conflict(
        'HOLD_CONFLICT',
        'One of those tables is held for another booking. Re-quote and try again.',
        { details: { holdId: error.holdId ?? null } },
      );
    }

    if (error instanceof ServiceNotFoundError) {
      // The policy message embeds the attempted timestamp; send fixed copy instead.
      return apiError(422, 'SERVICE_NOT_FOUND', 'No service is open at this booking time.');
    }

    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: bookingRow.restaurant_id },
      properties: {
        bookingId,
        restaurantId: bookingRow.restaurant_id,
        source: 'ops',
        kind: 'staff-auto-quote',
      },
    });
    return internalError(
      error,
      { route: '/api/staff/auto/quote', bookingId, restaurantId: bookingRow.restaurant_id },
      'Unable to quote tables',
    );
  }
}
