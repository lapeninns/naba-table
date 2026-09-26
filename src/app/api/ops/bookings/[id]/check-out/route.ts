import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { enqueueCheckOutSideEffects } from '@/server/jobs/booking-side-effects';
import { prepareCheckOutTransition } from '@/server/ops/booking-lifecycle/actions';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import {
  buildLifecycleSuccessBody,
  lifecycleValidationErrorResponse,
  missingBookingIdResponse,
} from '../_shared/lifecycleResponses';
import {
  loadLifecycleRouteContext,
  parseOptionalRouteBody,
  persistLifecycleTransition,
  resolveBookingId,
} from '../_shared/lifecycleRoute';

import type { NextRequest } from 'next/server';

const bodySchema = z
  .object({
    performedAt: z.string().datetime({ offset: true }).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

const LOG_LABEL = 'booking-check-out';
const checkOutLogger = logger.child({ module: 'api.ops.bookings.check_out' });

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => postCheckOut(req, { params }));
}

async function postCheckOut(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return missingBookingIdResponse();
  }

  const parsedBody = await parseOptionalRouteBody(req, bodySchema);
  if (parsedBody.response) {
    return parsedBody.response;
  }
  const payload = parsedBody.data;

  const contextResult = await loadLifecycleRouteContext({
    req,
    bookingId: id,
    logLabel: LOG_LABEL,
  });
  if (contextResult.response) {
    return contextResult.response;
  }

  const { booking, serviceSupabase, userId } = contextResult.context;

  let transition;
  try {
    transition = prepareCheckOutTransition({
      booking: {
        id: booking.id,
        status: booking.status,
        checked_in_at: booking.checked_in_at,
        checked_out_at: booking.checked_out_at,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        restaurant_id: booking.restaurant_id,
      },
      actorId: userId,
      performedAt: payload.performedAt ?? null,
    });
  } catch (validationError) {
    return lifecycleValidationErrorResponse(validationError, {
      route: LOG_LABEL,
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
      userId,
      currentStatus: booking.status,
    });
  }

  const persistResult = await persistLifecycleTransition({
    booking,
    transition,
    serviceSupabase,
    logLabel: LOG_LABEL,
    userId,
    releaseAssignments: true,
  });
  if (persistResult.response) {
    return persistResult.response;
  }

  const { result } = persistResult;

  if (!result.changed) {
    return NextResponse.json(buildLifecycleSuccessBody({ booking, result }));
  }

  invalidateOpsDashboardCaches(booking.restaurant_id, {
    summaryDates: [booking.booking_date],
  });

  // Schedule the review request email after a real check-out. No "update" notification is
  // sent: check-out is an internal operational action, not a booking modification.
  try {
    const { data: fullBooking } = await serviceSupabase
      .from('bookings')
      .select('*')
      .eq('id', booking.id)
      .maybeSingle();

    if (fullBooking && booking.restaurant_id) {
      await enqueueCheckOutSideEffects(fullBooking, booking.restaurant_id);
    }
  } catch (sideEffectsError) {
    checkOutLogger.warn('check_out.review_schedule_failed', {
      bookingId: booking.id,
      errorName:
        sideEffectsError instanceof Error ? sideEffectsError.name : typeof sideEffectsError,
    });
  }

  // The transition released every table in the same transaction.
  return NextResponse.json(buildLifecycleSuccessBody({ booking, result, assignments: [] }));
}
