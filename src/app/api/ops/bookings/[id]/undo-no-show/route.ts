import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prepareUndoNoShowTransition } from '@/server/ops/booking-lifecycle/actions';
import { BookingLifecycleError } from '@/server/ops/booking-lifecycle/stateMachine';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import {
  loadLifecycleRouteContext,
  parseOptionalRouteBody,
  persistLifecycleTransition,
  resolveBookingId,
} from '../_shared/lifecycleRoute';

import type { NextRequest } from 'next/server';

const bodySchema = z
  .object({
    reason: z.string().trim().min(1).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => postUndoNoShow(req, { params }));
}

async function postUndoNoShow(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const parsedBody = await parseOptionalRouteBody(req, bodySchema);
  if (parsedBody.response) {
    return parsedBody.response;
  }
  const payload = parsedBody.data;

  const contextResult = await loadLifecycleRouteContext({
    req,
    bookingId: id,
    logLabel: 'booking-undo-no-show',
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
    console.error('[ops][booking-undo-no-show] failed to read history', historyError.message);
    return NextResponse.json({ error: 'Unable to load history' }, { status: 500 });
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
    if (validationError instanceof BookingLifecycleError) {
      const status =
        validationError.code === 'TIMESTAMP_INVALID' || validationError.code === 'MISSING_HISTORY'
          ? 400
          : 409;
      return NextResponse.json({ error: validationError.message }, { status });
    }
    console.error('[ops][booking-undo-no-show] unexpected validation error', validationError);
    return NextResponse.json({ error: 'Unable to process booking' }, { status: 500 });
  }

  const persistResult = await persistLifecycleTransition({
    booking,
    transition,
    serviceSupabase,
    logLabel: 'booking-undo-no-show',
    failureMessage: 'Unable to undo no-show',
  });
  if (persistResult.response) {
    return persistResult.response;
  }

  invalidateOpsDashboardCaches(booking.restaurant_id, {
    summaryDates: [booking.booking_date],
  });

  return NextResponse.json({
    status: persistResult.result.status,
    checkedInAt: persistResult.result.checkedInAt,
    checkedOutAt: persistResult.result.checkedOutAt,
  });
}
