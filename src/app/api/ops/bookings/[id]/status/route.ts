import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  internalError,
  notFound,
  unauthenticated,
  validationError as validationErrorResponse,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { enqueueCheckOutSideEffects } from '@/server/jobs/booking-side-effects';
import {
  prepareCheckInTransition,
  prepareCheckOutTransition,
  prepareNoShowTransition,
} from '@/server/ops/booking-lifecycle/actions';
import { isBookingLifecycleAllowedToday } from '@/server/ops/booking-lifecycle/availability';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import {
  lifecycleValidationErrorResponse,
  missingBookingIdResponse,
} from '../_shared/lifecycleResponses';
import { persistLifecycleTransition, resolveBookingId } from '../_shared/lifecycleRoute';

import type { Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const statusLogger = logger.child({ module: 'api.ops.bookings.status' });

const bodySchema = z.object({
  status: z.enum(['completed', 'no_show']),
});

const STATUS_DEPRECATION_HEADERS = {
  Deprecation: 'true',
  Sunset: 'Mon, 01 Jun 2026 00:00:00 GMT',
  Link: '</api/ops/bookings/[id]>; rel="successor-version"',
} as const;

function withStatusDeprecation(response: NextResponse): NextResponse {
  response.headers.set('Deprecation', STATUS_DEPRECATION_HEADERS.Deprecation);
  response.headers.set('Sunset', STATUS_DEPRECATION_HEADERS.Sunset);
  response.headers.set('Link', STATUS_DEPRECATION_HEADERS.Link);
  return response;
}

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => patchBookingStatus(req, { params }));
}

async function patchBookingStatus(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const id = await resolveBookingId(params);
  if (!id) {
    return withStatusDeprecation(missingBookingIdResponse());
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withStatusDeprecation(validationErrorResponse(error));
    }
    return withStatusDeprecation(
      apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.'),
    );
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    statusLogger.warn('status.auth_failed', { bookingId: id });
    return withStatusDeprecation(unauthenticated('Unable to verify session'));
  }

  if (!user) {
    return withStatusDeprecation(unauthenticated('Unauthorized'));
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from('bookings')
    .select(
      'id, restaurant_id, status, checked_in_at, checked_out_at, booking_date, start_time, end_time',
    )
    .eq('id', id)
    .maybeSingle();

  if (bookingError) {
    return withStatusDeprecation(
      internalError(bookingError, {
        route: 'booking-status',
        stage: 'load_booking',
        bookingId: id,
      }),
    );
  }

  const bookingRow = booking as Tables<'bookings'> | null;

  if (!bookingRow) {
    return withStatusDeprecation(notFound('BOOKING_NOT_FOUND', 'Booking not found'));
  }

  try {
    const memberships = await fetchUserMemberships(user.id, tenantSupabase);
    const hasAccess = memberships.some(
      (membership) => membership.restaurant_id === bookingRow.restaurant_id,
    );
    if (!hasAccess) {
      return withStatusDeprecation(notFound('BOOKING_NOT_FOUND', 'Booking not found'));
    }
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      properties: { bookingId: id, source: 'ops', kind: 'ops-booking-status' },
    });
    return withStatusDeprecation(
      internalError(error, { route: 'booking-status', stage: 'memberships', bookingId: id }),
    );
  }

  const { data: restaurant, error: restaurantError } = await serviceSupabase
    .from('restaurants')
    .select('timezone, reservation_lifecycle_grace_minutes')
    .eq('id', bookingRow.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    return withStatusDeprecation(
      internalError(restaurantError, {
        route: 'booking-status',
        stage: 'load_restaurant',
        bookingId: id,
      }),
    );
  }

  const timezone =
    typeof restaurant?.timezone === 'string' && restaurant.timezone.trim().length > 0
      ? restaurant.timezone
      : 'UTC';
  if (
    !isBookingLifecycleAllowedToday({
      bookingDate: bookingRow.booking_date,
      timezone,
      startTime: bookingRow.start_time,
      endTime: bookingRow.end_time,
      graceMinutes: restaurant?.reservation_lifecycle_grace_minutes ?? undefined,
    })
  ) {
    return withStatusDeprecation(
      conflict(
        'LIFECYCLE_DATE_LOCKED',
        'Lifecycle actions are only available on the reservation date',
      ),
    );
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'ops-bookings:status-mutation',
    tenantId: bookingRow.restaurant_id,
    userId: user.id,
    limit: 30,
    windowMs: 60_000,
    message: 'Too many booking status requests. Please try again later.',
  });
  if (rateLimit) {
    return withStatusDeprecation(rateLimit);
  }

  try {
    const applyTransition = async (transition: ReturnType<typeof prepareCheckInTransition>) => {
      const persistResult = await persistLifecycleTransition({
        booking: bookingRow,
        transition,
        serviceSupabase,
        logLabel: 'booking-status',
        userId: user.id,
        releaseAssignments:
          transition.updates.status === 'no_show' || transition.updates.status === 'completed',
      });

      if (persistResult.response) {
        return {
          response: withStatusDeprecation(persistResult.response),
          result: null,
        };
      }

      return {
        response: null,
        result: persistResult.result,
      };
    };

    // This endpoint is deprecated but still used by the UI.
    // Ensure it performs the canonical lifecycle transitions and schedules post-checkout side-effects.
    let finalStatus: Tables<'bookings'>['status'] = bookingRow.status;

    if (payload.status === 'no_show') {
      const transition = prepareNoShowTransition({
        booking: {
          id: bookingRow.id,
          status: bookingRow.status,
          checked_in_at: bookingRow.checked_in_at,
          checked_out_at: bookingRow.checked_out_at,
          booking_date: bookingRow.booking_date,
          start_time: bookingRow.start_time,
          restaurant_id: bookingRow.restaurant_id,
        },
        actorId: user.id,
      });

      const persisted = await applyTransition(transition);
      if (persisted.response) {
        return persisted.response;
      }
      if (!persisted.result) {
        return withStatusDeprecation(
          internalError(new Error('Transition returned no result'), {
            route: 'booking-status',
            bookingId: id,
          }),
        );
      }
      finalStatus = persisted.result.status as Tables<'bookings'>['status'];

      invalidateOpsDashboardCaches(bookingRow.restaurant_id, {
        summaryDates: [bookingRow.booking_date],
      });

      return withStatusDeprecation(
        NextResponse.json({
          status: finalStatus,
        }),
      );
    }

    // payload.status === "completed"
    // Ensure the booking is checked in before completing it.
    if (!bookingRow.checked_in_at) {
      const checkIn = prepareCheckInTransition({
        booking: {
          id: bookingRow.id,
          status: bookingRow.status,
          checked_in_at: bookingRow.checked_in_at,
          checked_out_at: bookingRow.checked_out_at,
          booking_date: bookingRow.booking_date,
          start_time: bookingRow.start_time,
          restaurant_id: bookingRow.restaurant_id,
        },
        actorId: user.id,
        reason: 'ops-status-complete',
      });

      const checkInResult = await applyTransition(checkIn);
      if (checkInResult.response) {
        return checkInResult.response;
      }
      if (!checkInResult.result) {
        return withStatusDeprecation(
          internalError(new Error('Transition returned no result'), {
            route: 'booking-status',
            bookingId: id,
          }),
        );
      }
      bookingRow.status = checkInResult.result.status as Tables<'bookings'>['status'];
      bookingRow.checked_in_at = checkInResult.result.checkedInAt;
      bookingRow.checked_out_at = checkInResult.result.checkedOutAt;
    }

    const checkOut = prepareCheckOutTransition({
      booking: {
        id: bookingRow.id,
        status: bookingRow.status,
        checked_in_at: bookingRow.checked_in_at,
        checked_out_at: bookingRow.checked_out_at,
        booking_date: bookingRow.booking_date,
        start_time: bookingRow.start_time,
        restaurant_id: bookingRow.restaurant_id,
      },
      actorId: user.id,
      reason: 'ops-status-complete',
    });

    const checkOutResult = await applyTransition(checkOut);
    if (checkOutResult.response) {
      return checkOutResult.response;
    }
    if (!checkOutResult.result) {
      return withStatusDeprecation(
        internalError(new Error('Transition returned no result'), {
          route: 'booking-status',
          bookingId: id,
        }),
      );
    }
    finalStatus = checkOutResult.result.status as Tables<'bookings'>['status'];

    if (checkOutResult.result.changed) {
      invalidateOpsDashboardCaches(bookingRow.restaurant_id, {
        summaryDates: [bookingRow.booking_date],
      });

      // Schedule review request email after completion (same as check-out route)
      try {
        const { data: fullBooking } = await serviceSupabase
          .from('bookings')
          .select('*')
          .eq('id', bookingRow.id)
          .maybeSingle();

        if (fullBooking && bookingRow.restaurant_id) {
          await enqueueCheckOutSideEffects(fullBooking, bookingRow.restaurant_id);
        }
      } catch (sideEffectsError) {
        statusLogger.warn('status.review_schedule_failed', {
          bookingId: bookingRow.id,
          errorName:
            sideEffectsError instanceof Error ? sideEffectsError.name : typeof sideEffectsError,
        });
      }
    }

    return withStatusDeprecation(
      NextResponse.json({
        status: finalStatus,
      }),
    );
  } catch (validationError) {
    return withStatusDeprecation(
      lifecycleValidationErrorResponse(validationError, {
        route: 'booking-status',
        bookingId: id,
        restaurantId: bookingRow.restaurant_id,
        userId: user.id,
        currentStatus: bookingRow.status,
      }),
    );
  }
}
