import { NextResponse } from 'next/server';
import { z } from 'zod';

import { internalError } from '@/lib/api/errors';
import { prepareUndoNoShowTransition } from '@/server/ops/booking-lifecycle/actions';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import {
  buildLifecycleSuccessBody,
  lifecycleValidationErrorResponse,
  missingBookingIdResponse,
} from '../_shared/lifecycleResponses';
import {
  loadBookingAssignmentRows,
  loadLifecycleRouteContext,
  parseOptionalRouteBody,
  persistUndoNoShowTransition,
  resolveBookingId,
} from '../_shared/lifecycleRoute';

import type { NextRequest } from 'next/server';

const bodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

const LOG_LABEL = 'booking-undo-no-show';

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => postUndoNoShow(req, { params }));
}

async function postUndoNoShow(req: NextRequest, { params }: RouteParams) {
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

  const { data: historyEntry, error: historyError } = await serviceSupabase
    .from('booking_state_history')
    .select('id, booking_id, from_status, to_status, changed_by, changed_at, reason, metadata')
    .eq('booking_id', id)
    .eq('to_status', 'no_show')
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (historyError) {
    return internalError(historyError, { route: LOG_LABEL, stage: 'load_history', bookingId: id });
  }

  let transition;
  try {
    transition = prepareUndoNoShowTransition({
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
      historyEntry: historyEntry ?? null,
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

  const sourceHistoryId = historyEntry ? Number(historyEntry.id) : Number.NaN;
  if (!Number.isSafeInteger(sourceHistoryId)) {
    return internalError(new Error('No-show history id is not an integer'), {
      route: LOG_LABEL,
      stage: 'history_id',
      bookingId: id,
    });
  }

  // One transaction: compare-and-set no_show -> previous status, then re-assign the tables
  // the no-show released if they are all still free (all-or-nothing).
  const persistResult = await persistUndoNoShowTransition({
    booking,
    transition,
    sourceHistoryId,
    serviceSupabase,
    logLabel: LOG_LABEL,
    userId,
  });
  if (persistResult.response) {
    return persistResult.response;
  }

  const { result } = persistResult;

  invalidateOpsDashboardCaches(booking.restaurant_id, {
    summaryDates: [booking.booking_date],
  });

  // Re-read rather than assume []: a table may have been assigned while the booking was a
  // no-show.
  const assignments = await loadBookingAssignmentRows(serviceSupabase, booking.id, LOG_LABEL);

  return NextResponse.json(
    buildLifecycleSuccessBody({
      booking,
      result,
      // null = committed but could not be re-read; the client refetches instead.
      assignments: assignments ?? undefined,
      tableRestoration: result.tableRestoration,
    }),
  );
}
