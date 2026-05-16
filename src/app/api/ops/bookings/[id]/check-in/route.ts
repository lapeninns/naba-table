import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prepareCheckInTransition } from '@/server/ops/booking-lifecycle/actions';
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
    performedAt: z.string().datetime({ offset: true }).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => postCheckIn(req, { params }));
}

async function postCheckIn(req: NextRequest, { params }: RouteParams) {
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
    logLabel: 'booking-check-in',
  });
  if (contextResult.response) {
    return contextResult.response;
  }

  const { booking, serviceSupabase, userId } = contextResult.context;

  let transition;
  try {
    transition = prepareCheckInTransition({
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
    if (validationError instanceof BookingLifecycleError) {
      const status = validationError.code === 'TIMESTAMP_INVALID' ? 400 : 409;
      return NextResponse.json({ error: validationError.message }, { status });
    }
    console.error('[ops][booking-check-in] unexpected validation error', validationError);
    return NextResponse.json({ error: 'Unable to process booking' }, { status: 500 });
  }

  const persistResult = await persistLifecycleTransition({
    booking,
    transition,
    serviceSupabase,
    logLabel: 'booking-check-in',
    failureMessage: 'Unable to check in booking',
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
