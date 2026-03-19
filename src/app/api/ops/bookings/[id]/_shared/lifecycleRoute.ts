import { NextResponse } from "next/server";
import { z } from "zod";

import { mapSupabaseAuthError } from "@/server/auth/supabase-auth-errors";
import { isBookingLifecycleAllowedToday } from "@/server/ops/booking-lifecycle/availability";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { TransitionResult } from "@/server/ops/booking-lifecycle/actions";
import type { Tables } from "@/types/supabase";
import type { NextRequest } from "next/server";

type ParamsPromise = Promise<{ id: string | string[] }> | undefined;

export type LifecycleRouteBooking = Pick<
  Tables<"bookings">,
  "id" | "restaurant_id" | "status" | "checked_in_at" | "checked_out_at" | "booking_date" | "start_time" | "end_time"
>;

type LifecycleRouteContext = {
  userId: string;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
  booking: LifecycleRouteBooking;
};

type ContextResult =
  | { context: LifecycleRouteContext; response?: never }
  | { context?: never; response: NextResponse };

type BodyParseResult<T> =
  | { data: T; response?: never }
  | { data?: never; response: NextResponse };

type PersistTransitionResult =
  | {
      result: {
        status: Tables<"bookings">["status"];
        checkedInAt: string | null;
        checkedOutAt: string | null;
        updatedAt: string | null;
      };
      response?: never;
    }
  | { result?: never; response: NextResponse };

export async function resolveBookingId(paramsPromise: ParamsPromise): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === "string") return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function parseOptionalRouteBody<TSchema extends z.ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
): Promise<BodyParseResult<z.infer<TSchema>>> {
  try {
    const contentLengthHeader = req.headers.get("content-length");
    const hasBody = contentLengthHeader !== null && Number.parseInt(contentLengthHeader, 10) > 0;
    const rawBody = hasBody ? await req.json() : {};
    return {
      data: schema.parse(rawBody),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        response: NextResponse.json(
          { error: "Invalid payload", details: error.flatten() },
          { status: 400 },
        ),
      };
    }

    return {
      response: NextResponse.json({ error: "Invalid payload" }, { status: 400 }),
    };
  }
}

export async function loadLifecycleRouteContext(input: {
  bookingId: string;
  logLabel: string;
}): Promise<ContextResult> {
  const { bookingId, logLabel } = input;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(`[ops][${logLabel}] failed to resolve auth`, error.message);
    const mapped = mapSupabaseAuthError(error);
    return {
      response: NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status }),
    };
  }

  if (!user) {
    return {
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select("id, restaurant_id, status, checked_in_at, checked_out_at, booking_date, start_time, end_time")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error(`[ops][${logLabel}] failed to load booking`, bookingError.message);
    return {
      response: NextResponse.json({ error: "Unable to load booking" }, { status: 500 }),
    };
  }

  const bookingRow = booking as LifecycleRouteBooking | null;
  if (!bookingRow) {
    return {
      response: NextResponse.json({ error: "Booking not found" }, { status: 404 }),
    };
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: bookingRow.restaurant_id });
  } catch (accessError) {
    console.error(`[ops][${logLabel}] access denied`, accessError);
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: restaurant, error: restaurantError } = await serviceSupabase
    .from("restaurants")
    .select("timezone, reservation_lifecycle_grace_minutes")
    .eq("id", bookingRow.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error(`[ops][${logLabel}] failed to load restaurant`, restaurantError.message);
    return {
      response: NextResponse.json({ error: "Unable to verify booking" }, { status: 500 }),
    };
  }

  const timezone =
    typeof restaurant?.timezone === "string" && restaurant.timezone.trim().length > 0
      ? restaurant.timezone
      : "UTC";
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
        { error: "Lifecycle actions are only available on the reservation date" },
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
}): Promise<PersistTransitionResult> {
  const { booking, transition, serviceSupabase, logLabel, failureMessage } = input;

  if (transition.skipUpdate) {
    return {
      result: {
        status: transition.response.status,
        checkedInAt: transition.response.checkedInAt ?? null,
        checkedOutAt: transition.response.checkedOutAt ?? null,
        updatedAt: transition.response.updatedAt ?? null,
      },
    };
  }

  const historyRecord = transition.history;
  if (!historyRecord) {
    console.error(`[ops][${logLabel}] missing history payload for transition`);
    return {
      response: NextResponse.json({ error: "Unable to record booking transition" }, { status: 500 }),
    };
  }

  const targetStatus = (transition.updates.status ?? booking.status) as Tables<"bookings">["status"];
  const finalCheckedInAt =
    transition.updates.checked_in_at !== undefined
      ? transition.updates.checked_in_at ?? null
      : booking.checked_in_at ?? null;
  const finalCheckedOutAt =
    transition.updates.checked_out_at !== undefined
      ? transition.updates.checked_out_at ?? null
      : booking.checked_out_at ?? null;
  const finalUpdatedAt = transition.updates.updated_at ?? new Date().toISOString();

  const { data: transitionResult, error: transitionError } = await serviceSupabase.rpc(
    "apply_booking_state_transition",
    {
      p_booking_id: booking.id,
      p_status: targetStatus,
      p_checked_in_at: finalCheckedInAt,
      p_checked_out_at: finalCheckedOutAt,
      p_updated_at: finalUpdatedAt,
      p_history_from: historyRecord.from_status ?? booking.status,
      p_history_to: historyRecord.to_status,
      p_history_changed_by: historyRecord.changed_by ?? null,
      p_history_changed_at: historyRecord.changed_at ?? finalUpdatedAt,
      p_history_reason: historyRecord.reason ?? "status_change",
      p_history_metadata: historyRecord.metadata ?? {},
    },
  );

  if (transitionError) {
    console.error(`[ops][${logLabel}] failed to persist transition`, transitionError.message);
    return {
      response: NextResponse.json({ error: failureMessage }, { status: 500 }),
    };
  }

  const resultRow = transitionResult?.[0];
  return {
    result: {
      status: resultRow?.status ?? targetStatus,
      checkedInAt: resultRow?.checked_in_at ?? finalCheckedInAt,
      checkedOutAt: resultRow?.checked_out_at ?? finalCheckedOutAt,
      updatedAt: resultRow?.updated_at ?? finalUpdatedAt,
    },
  };
}
