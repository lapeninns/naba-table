import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prepareNoShowTransition } from '@/server/ops/booking-lifecycle/actions';
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
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

const LOG_LABEL = 'booking-no-show';

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => postNoShow(req, { params }));
}

async function postNoShow(req: NextRequest, { params }: RouteParams) {
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
    transition = prepareNoShowTransition({
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
      reason: payload.reason ?? null,
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

  // The releasing RPC records the released tables on the no-show history row, which is
  // what lets undo-no-show restore them.
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

  invalidateOpsDashboardCaches(booking.restaurant_id, {
    summaryDates: [booking.booking_date],
  });

  return NextResponse.json(
    buildLifecycleSuccessBody({ booking, result: persistResult.result, assignments: [] }),
  );
}
