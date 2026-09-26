import { z } from 'zod';

import {
  apiError,
  conflict,
  internalError,
  notFound,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { isBookingLifecycleAllowedToday } from '@/server/ops/booking-lifecycle/availability';
import {
  applyBookingStateTransition,
  applyUndoNoShowTransition,
  type UndoNoShowPersistenceResult,
} from '@/server/ops/booking-lifecycle/persistence';
import {
  isBookingNotFoundRpcError,
  isBookingStateConflictError,
  isBookingStatus,
  isNoShowHistoryMissingError,
  type BookingStatus,
} from '@/server/ops/booking-lifecycle/rpcErrors';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import { bookingStateConflict, type LifecycleAssignmentRow } from './lifecycleResponses';

import type { TransitionResult } from '@/server/ops/booking-lifecycle/actions';
import type { Tables } from '@/types/supabase';
import type { NextRequest, NextResponse } from 'next/server';

const lifecycleLogger = logger.child({ module: 'api.ops.bookings.lifecycle' });

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

type PersistUndoResult =
  | { result: UndoNoShowPersistenceResult; response?: never }
  | { result?: never; response: NextResponse };

type ServiceClient = ReturnType<typeof getServiceSupabaseClient>;

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
      return { response: validationError(error) };
    }

    return {
      response: apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.'),
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
    const mapped = mapSupabaseAuthError(error);
    lifecycleLogger.warn('lifecycle.auth_failed', { route: logLabel, status: mapped.status });
    return { response: apiError(mapped.status, mapped.code, mapped.message) };
  }

  if (!user) {
    return { response: unauthenticated('Authentication required') };
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
    return {
      response: internalError(bookingError, { route: logLabel, stage: 'load_booking', bookingId }),
    };
  }

  const bookingRow = booking as LifecycleRouteBooking | null;
  if (!bookingRow) {
    return { response: notFound('BOOKING_NOT_FOUND', 'Booking not found') };
  }

  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: bookingRow.restaurant_id,
      client: supabase,
    });
  } catch {
    // Non-members get the same 404 as a missing booking (no existence oracle).
    lifecycleLogger.info('lifecycle.access_denied', { route: logLabel, bookingId });
    return { response: notFound('BOOKING_NOT_FOUND', 'Booking not found') };
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
    return {
      response: internalError(restaurantError, {
        route: logLabel,
        stage: 'load_restaurant',
        bookingId,
      }),
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
      response: conflict(
        'LIFECYCLE_DATE_LOCKED',
        'Lifecycle actions are only available on the reservation date',
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

/** Current status after a lost compare-and-set, for `details.currentStatus`. */
async function loadCurrentStatus(
  serviceSupabase: ServiceClient,
  bookingId: string,
): Promise<BookingStatus | null> {
  try {
    const { data, error } = await serviceSupabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();
    if (error) return null;
    const status = (data as { status?: unknown } | null)?.status;
    return isBookingStatus(status) ? status : null;
  } catch {
    return null;
  }
}

/**
 * Maps a lifecycle RPC failure to C1: a lost compare-and-set (`booking_state_conflict`)
 * is a 409 BOOKING_STATE_CONFLICT with the current status, a vanished booking is a 404,
 * anything else a logged 500 without DB text.
 */
async function mapTransitionFailure(input: {
  error: unknown;
  booking: LifecycleRouteBooking;
  serviceSupabase: ServiceClient;
  logLabel: string;
  userId?: string;
}): Promise<NextResponse> {
  const { error, booking, serviceSupabase, logLabel, userId } = input;

  if (isBookingStateConflictError(error)) {
    const currentStatus = await loadCurrentStatus(serviceSupabase, booking.id);
    lifecycleLogger.info('lifecycle.state_conflict', {
      route: logLabel,
      bookingId: booking.id,
      expectedStatus: booking.status,
      currentStatus,
    });
    return bookingStateConflict(currentStatus);
  }

  if (isNoShowHistoryMissingError(error)) {
    return apiError(
      400,
      'NO_SHOW_HISTORY_MISSING',
      'There is no no-show to undo for this booking.',
    );
  }

  if (isBookingNotFoundRpcError(error)) {
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  captureServerException(error, {
    distinctId: userId,
    groups: booking.restaurant_id ? { restaurant: booking.restaurant_id } : undefined,
    properties: { bookingId: booking.id, source: 'ops', kind: logLabel },
  });
  return internalError(error, {
    route: logLabel,
    stage: 'persist_transition',
    bookingId: booking.id,
  });
}

export async function persistLifecycleTransition(input: {
  booking: LifecycleRouteBooking;
  transition: TransitionResult;
  serviceSupabase: ServiceClient;
  logLabel: string;
  userId?: string;
  releaseAssignments?: boolean;
}): Promise<PersistTransitionResult> {
  const { booking, transition, serviceSupabase, releaseAssignments } = input;

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
    return { response: await mapTransitionFailure({ ...input, error: transitionError }) };
  }
}

export async function persistUndoNoShowTransition(input: {
  booking: LifecycleRouteBooking;
  transition: TransitionResult;
  sourceHistoryId: number;
  serviceSupabase: ServiceClient;
  logLabel: string;
  userId?: string;
}): Promise<PersistUndoResult> {
  const { booking, transition, sourceHistoryId, serviceSupabase } = input;

  try {
    return {
      result: await applyUndoNoShowTransition({
        supabase: serviceSupabase,
        booking,
        transition,
        sourceHistoryId,
      }),
    };
  } catch (transitionError) {
    return { response: await mapTransitionFailure({ ...input, error: transitionError }) };
  }
}

/**
 * The booking's assignment rows after a write, in the assign-tables row shape. Returns
 * null when they cannot be read (the write already committed; the client then refetches).
 */
export async function loadBookingAssignmentRows(
  serviceSupabase: ServiceClient,
  bookingId: string,
  logLabel: string,
): Promise<LifecycleAssignmentRow[] | null> {
  const { data, error } = await serviceSupabase
    .from('booking_table_assignments')
    .select('id, booking_id, table_id, assigned_at, assigned_by')
    .eq('booking_id', bookingId)
    .order('table_id', { ascending: true });

  if (error || !data) {
    lifecycleLogger.warn('lifecycle.assignments_reload_failed', { route: logLabel, bookingId });
    return null;
  }

  return data.map((row) => ({
    id: row.id,
    booking_id: row.booking_id,
    table_id: row.table_id,
    assigned_at: row.assigned_at,
    assigned_by: row.assigned_by ?? null,
  }));
}
