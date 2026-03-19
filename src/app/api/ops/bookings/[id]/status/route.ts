import { NextResponse } from "next/server";
import { z } from "zod";

import { clearBookingTableAssignments } from "@/server/bookings";
import { enqueueCheckOutSideEffects } from "@/server/jobs/booking-side-effects";
import {
  prepareCheckInTransition,
  prepareCheckOutTransition,
  prepareNoShowTransition,
} from "@/server/ops/booking-lifecycle/actions";
import { isBookingLifecycleAllowedToday } from "@/server/ops/booking-lifecycle/availability";
import { BookingLifecycleError } from "@/server/ops/booking-lifecycle/stateMachine";
import { invalidateOpsDashboardCaches } from "@/server/ops/bookings";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";

import { persistLifecycleTransition, resolveBookingId } from "../_shared/lifecycleRoute";

import type { Tables } from "@/types/supabase";
import type { NextRequest } from "next/server";


const bodySchema = z.object({
  status: z.enum(["completed", "no_show"]),
});

const STATUS_DEPRECATION_HEADERS = {
  Deprecation: "true",
  Sunset: "Mon, 01 Jun 2026 00:00:00 GMT",
  Link: "</api/ops/bookings/[id]>; rel=\"successor-version\"",
} as const;

function withStatusDeprecation(response: NextResponse): NextResponse {
  response.headers.set("Deprecation", STATUS_DEPRECATION_HEADERS.Deprecation);
  response.headers.set("Sunset", STATUS_DEPRECATION_HEADERS.Sunset);
  response.headers.set("Link", STATUS_DEPRECATION_HEADERS.Link);
  return response;
}

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return withStatusDeprecation(NextResponse.json({ error: "Missing booking id" }, { status: 400 }));
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withStatusDeprecation(
        NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 }),
      );
    }
    return withStatusDeprecation(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops][booking-status] failed to resolve auth", authError.message);
    return withStatusDeprecation(NextResponse.json({ error: "Unable to verify session" }, { status: 401 }));
  }

  if (!user) {
    return withStatusDeprecation(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select("id, restaurant_id, status, checked_in_at, checked_out_at, booking_date, start_time, end_time")
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error("[ops][booking-status] failed to load booking", bookingError.message);
    return withStatusDeprecation(NextResponse.json({ error: "Unable to load booking" }, { status: 500 }));
  }

  const bookingRow = booking as Tables<"bookings"> | null;

  if (!bookingRow) {
    return withStatusDeprecation(NextResponse.json({ error: "Booking not found" }, { status: 404 }));
  }

  const { data: restaurant, error: restaurantError } = await serviceSupabase
    .from("restaurants")
    .select("timezone, reservation_lifecycle_grace_minutes")
    .eq("id", bookingRow.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("[ops][booking-status] failed to load restaurant", restaurantError.message);
    return withStatusDeprecation(NextResponse.json({ error: "Unable to verify booking" }, { status: 500 }));
  }

  const timezone = typeof restaurant?.timezone === "string" && restaurant.timezone.trim().length > 0 ? restaurant.timezone : "UTC";
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
      NextResponse.json({ error: "Lifecycle actions are only available on the reservation date" }, { status: 409 }),
    );
  }

  try {
    const memberships = await fetchUserMemberships(user.id, tenantSupabase);
    const hasAccess = memberships.some((membership) => membership.restaurant_id === bookingRow.restaurant_id);
    if (!hasAccess) {
      return withStatusDeprecation(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }
  } catch (error) {
    console.error("[ops][booking-status] membership lookup failed", error);
    return withStatusDeprecation(NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 }));
  }

  try {
    const applyTransition = async (transition: ReturnType<typeof prepareCheckInTransition>) => {
      const persistResult = await persistLifecycleTransition({
        booking: bookingRow,
        transition,
        serviceSupabase,
        logLabel: "booking-status",
        failureMessage: "Unable to update booking",
      });

      if (persistResult.response) {
        return {
          response: withStatusDeprecation(persistResult.response),
        };
      }

      return {
        result: persistResult.result,
      };
    };

    // This endpoint is deprecated but still used by the UI.
    // Ensure it performs the canonical lifecycle transitions and schedules post-checkout side-effects.
    let finalStatus: Tables<"bookings">["status"] = bookingRow.status;

    if (payload.status === "no_show") {
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
      if ("response" in persisted) {
        return persisted.response;
      }
      finalStatus = persisted.result.status as Tables<"bookings">["status"];

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
        reason: "ops-status-complete",
      });

      const checkInResult = await applyTransition(checkIn);
      if ("response" in checkInResult) {
        return checkInResult.response;
      }
      bookingRow.status = checkInResult.result.status as Tables<"bookings">["status"];
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
      reason: "ops-status-complete",
    });

    const checkOutResult = await applyTransition(checkOut);
    if ("response" in checkOutResult) {
      return checkOutResult.response;
    }
    finalStatus = checkOutResult.result.status as Tables<"bookings">["status"];

    // Release any table assignments once completed
    try {
      await clearBookingTableAssignments(serviceSupabase, bookingRow.id);
    } catch (clearError) {
      console.warn("[ops][booking-status] failed to clear table assignments", {
        bookingId: bookingRow.id,
        error: clearError instanceof Error ? clearError.message : clearError,
      });
    }

    invalidateOpsDashboardCaches(bookingRow.restaurant_id, {
      summaryDates: [bookingRow.booking_date],
    });

    // Schedule review request email after completion (same as check-out route)
    try {
      const { data: fullBooking } = await serviceSupabase
        .from("bookings")
        .select("*")
        .eq("id", bookingRow.id)
        .maybeSingle();

      if (fullBooking && bookingRow.restaurant_id) {
        await enqueueCheckOutSideEffects(fullBooking, bookingRow.restaurant_id);
      }
    } catch (sideEffectsError) {
      console.warn("[ops][booking-status] failed to schedule review email", {
        bookingId: bookingRow.id,
        error: sideEffectsError instanceof Error ? sideEffectsError.message : sideEffectsError,
      });
    }

    return withStatusDeprecation(
      NextResponse.json({
        status: finalStatus,
      }),
    );
  } catch (validationError) {
    if (validationError instanceof BookingLifecycleError) {
      const statusCode = validationError.code === "TIMESTAMP_INVALID" ? 400 : 409;
      return withStatusDeprecation(
        NextResponse.json({ error: validationError.message }, { status: statusCode }),
      );
    }
    console.error("[ops][booking-status] unexpected validation error", validationError);
    return withStatusDeprecation(NextResponse.json({ error: "Unable to update booking" }, { status: 500 }));
  }
}
