import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { isBookingLifecycleAllowedToday } from '@/server/ops/booking-lifecycle/availability';
import { applyBookingStateTransition } from '@/server/ops/booking-lifecycle/persistence';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { TransitionResult } from '@/server/ops/booking-lifecycle/actions';
import type { Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

type ParamsPromise = Promise<{ id: string | string[] }> | undefined;

export type LifecycleRouteBooking = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'restaurant_id'
  | 'status'
  | 'checked_in_at'
  | 'checked_out_at'
  | 'booking_date'
  | 'start_time'
  | 'end_time'
>;

type LifecycleRouteContext = {
  userId: string;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
  booking: LifecycleRouteBooking;
};

type ContextResult =
  | { context: LifecycleRouteContext; response?: never }
  | { context?: never; response: NextResponse };

type BodyParseResult<T> = { data: T; response?: never } | { data?: never; response: NextResponse };

type PersistTransitionResult =
  | {
      result: {
        status: Tables<'bookings'>['status'];
        checkedInAt: string | null;
        checkedOutAt: string | null;
        updatedAt: string | null;
        changed: boolean;
      };
      response?: never;
    }
  | { result?: never; response: NextResponse };

export async function resolveBookingId(paramsPromise: ParamsPromise): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function parseOptionalRouteBody<TSchema extends z.ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
): Promise<BodyParseResult<z.infer<TSchema>>> {
  try {
    const contentLengthHeader = req.headers.get('content-length');
    const hasBody = contentLengthHeader !== null && Number.parseInt(contentLengthHeader, 10) > 0;
    const rawBody = hasBody ? await req.json() : {};
    return {
      data: schema.parse(rawBody),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        response: NextResponse.json(
          { error: 'Invalid payload', details: error.flatten() },
          { status: 400 },
        ),
      };
    }

    return {
      response: NextResponse.json({ error: 'Invalid payload' }, { status: 400 }),
    };
  }
}

export async function loadLifecycleRouteContext(input: {
  req: NextRequest;
  bookingId: string;
  logLabel: string;
}): Promise<ContextResult> {
  const { req, bookingId, logLabel } = input;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(`[ops][${logLabel}] failed to resolve auth`, error.message);
    const mapped = mapSupabaseAuthError(error);
    return {
      response: NextResponse.json(
        { error: mapped.message, code: mapped.code },
        { status: mapped.status },
      ),
    };
  }

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from('bookings')
    .select(
      'id, restaurant_id, status, checked_in_at, checked_out_at, booking_date, start_time, end_time',
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error(`[ops][${logLabel}] failed to load booking`, bookingError.message);
    return {
      response: NextResponse.json({ error: 'Unable to load booking' }, { status: 500 }),
    };
  }

  const bookingRow = booking as LifecycleRouteBooking | null;
  if (!bookingRow) {
    return {
      response: NextResponse.json({ error: 'Booking not found' }, { status: 404 }),
    };
  }

  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: bookingRow.restaurant_id,
      client: supabase,
    });
  } catch (accessError) {
    console.error(`[ops][${logLabel}] access denied`, accessError);
    return {
      response: NextResponse.json({ error: 'Booking not found' }, { status: 404 }),
    };
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'ops-bookings:lifecycle',
    tenantId: bookingRow.restaurant_id,
    userId: user.id,
    parts: [logLabel],
    limit: 30,
    windowMs: 60_000,
    message: 'Too many booking lifecycle requests. Please try again later.',
  });
  if (rateLimit) {
    return { response: rateLimit };
  }

  const { data: restaurant, error: restaurantError } = await serviceSupabase
    .from('restaurants')
    .select('timezone, reservation_lifecycle_grace_minutes')
    .eq('id', bookingRow.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error(`[ops][${logLabel}] failed to load restaurant`, restaurantError.message);
    return {
      response: NextResponse.json({ error: 'Unable to verify booking' }, { status: 500 }),
    };
  }

  const timezone =
    typeof restaurant?.timezone === 'string' && restaurant.timezone.trim().length > 0
      ? restaurant.timezone
      : 'UTC';
  const graceMinutes = restaurant?.reservation_lifecycle_grace_minutes ?? undefined;

  if (
    !isBookingLifecycleAllowedToday({
      bookingDate: bookingRow.booking_date,
      timezone,
      startTime: bookingRow.start_time,
      endTime: bookingRow.end_time,
      graceMinutes,
    })
  ) {
    return {
      response: NextResponse.json(
        { error: 'Lifecycle actions are only available on the reservation date' },
        { status: 409 },
      ),
    };
  }

  return {
    context: {
      userId: user.id,
      serviceSupabase,
      booking: bookingRow,
    },
  };
}

export async function persistLifecycleTransition(input: {
  booking: LifecycleRouteBooking;
  transition: TransitionResult;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
  logLabel: string;
  failureMessage: string;
  releaseAssignments?: boolean;
}): Promise<PersistTransitionResult> {
  const { booking, transition, serviceSupabase, logLabel, failureMessage, releaseAssignments } =
    input;

  try {
    return {
      result: await applyBookingStateTransition({
        supabase: serviceSupabase,
        booking,
        transition,
        releaseAssignments,
      }),
    };
  } catch (transitionError) {
    console.error(
      `[ops][${logLabel}] failed to persist transition`,
      transitionError instanceof Error ? transitionError.message : transitionError,
    );
    return {
      response: NextResponse.json({ error: failureMessage }, { status: 500 }),
    };
  }
}
