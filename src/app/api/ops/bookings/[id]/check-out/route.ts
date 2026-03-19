import { NextResponse } from "next/server";
import { z } from "zod";

import { clearBookingTableAssignments } from "@/server/bookings";
import { enqueueCheckOutSideEffects } from "@/server/jobs/booking-side-effects";
import { prepareCheckOutTransition } from "@/server/ops/booking-lifecycle/actions";
import { BookingLifecycleError } from "@/server/ops/booking-lifecycle/stateMachine";
import { invalidateOpsDashboardCaches } from "@/server/ops/bookings";

import {
  loadLifecycleRouteContext,
  parseOptionalRouteBody,
  persistLifecycleTransition,
  resolveBookingId,
} from "../_shared/lifecycleRoute";

import type { NextRequest } from "next/server";


const bodySchema = z
  .object({
    performedAt: z
      .string()
      .datetime({ offset: true })
      .optional(),
  })
  .optional()
  .transform((value) => value ?? {});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  const parsedBody = await parseOptionalRouteBody(req, bodySchema);
  if (parsedBody.response) {
    return parsedBody.response;
  }
  const payload = parsedBody.data;

  const contextResult = await loadLifecycleRouteContext({
    bookingId: id,
    logLabel: "booking-check-out",
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
    if (validationError instanceof BookingLifecycleError) {
      const status = validationError.code === "TIMESTAMP_INVALID" ? 400 : 409;
      return NextResponse.json({ error: validationError.message }, { status });
    }
    console.error("[ops][booking-check-out] unexpected validation error", validationError);
    return NextResponse.json({ error: "Unable to process booking" }, { status: 500 });
  }

  const persistResult = await persistLifecycleTransition({
    booking,
    transition,
    serviceSupabase,
    logLabel: "booking-check-out",
    failureMessage: "Unable to check out booking",
  });
  if (persistResult.response) {
    return persistResult.response;
  }

  // Release any table assignments once the booking has been checked out/completed
  try {
    await clearBookingTableAssignments(serviceSupabase, booking.id);
  } catch (clearError) {
    console.warn("[ops][booking-check-out] failed to clear table assignments", {
      bookingId: booking.id,
      error: clearError instanceof Error ? clearError.message : clearError,
    });
  }

  invalidateOpsDashboardCaches(booking.restaurant_id, {
    summaryDates: [booking.booking_date],
  });

  // Schedule review request email after successful check-out
  // Note: This ONLY schedules the review email - no "update" notification is sent
  // because check-out is an internal operational action, not a booking modification
  try {
    const { data: fullBooking } = await serviceSupabase
      .from("bookings")
      .select("*")
      .eq("id", booking.id)
      .maybeSingle();

    if (fullBooking && booking.restaurant_id) {
      await enqueueCheckOutSideEffects(fullBooking, booking.restaurant_id);
    }
  } catch (sideEffectsError) {
    console.warn("[ops][booking-check-out] failed to schedule review email", {
      bookingId: booking.id,
      error: sideEffectsError instanceof Error ? sideEffectsError.message : sideEffectsError,
    });
  }

  return NextResponse.json({
    status: persistResult.result.status,
    checkedInAt: persistResult.result.checkedInAt,
    checkedOutAt: persistResult.result.checkedOutAt,
  });
}
