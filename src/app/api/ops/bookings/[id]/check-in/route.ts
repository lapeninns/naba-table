import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prepareCheckInTransition } from "@/server/ops/booking-lifecycle/actions";
import { BookingLifecycleError } from "@/server/ops/booking-lifecycle/stateMachine";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";
import type { Tables } from "@/types/supabase";

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

async function resolveBookingId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === "string") return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  let payload: { performedAt?: string };
  try {
    const contentLengthHeader = req.headers.get("content-length");
    const hasBody =
      contentLengthHeader !== null && Number.parseInt(contentLengthHeader, 10) > 0;
    const rawBody = hasBody ? await req.json() : {};
    payload = bodySchema.parse(rawBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops][booking-check-in] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select("id, restaurant_id, status, checked_in_at, checked_out_at, booking_date, start_time")
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error("[ops][booking-check-in] failed to load booking", bookingError.message);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const bookingRow = booking as Tables<"bookings"> | null;
  if (!bookingRow) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: bookingRow.restaurant_id });
  } catch (accessError) {
    console.error("[ops][booking-check-in] access denied", accessError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let transition;
  try {
    transition = prepareCheckInTransition({
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
      performedAt: payload.performedAt ?? null,
    });
  } catch (validationError) {
    if (validationError instanceof BookingLifecycleError) {
      const status = validationError.code === "TIMESTAMP_INVALID" ? 400 : 409;
      return NextResponse.json({ error: validationError.message }, { status });
    }
    console.error("[ops][booking-check-in] unexpected validation error", validationError);
    return NextResponse.json({ error: "Unable to process booking" }, { status: 500 });
  }

  if (transition.skipUpdate) {
    return NextResponse.json({
      status: transition.response.status,
      checkedInAt: transition.response.checkedInAt,
      checkedOutAt: transition.response.checkedOutAt,
    });
  }

  const targetStatus = (transition.updates.status ?? bookingRow.status) as Tables<"bookings">["status"];
  const finalCheckedInAtRaw =
    transition.updates.checked_in_at !== undefined ? transition.updates.checked_in_at ?? null : bookingRow.checked_in_at;
  const finalCheckedOutAtRaw =
    transition.updates.checked_out_at !== undefined ? transition.updates.checked_out_at ?? null : bookingRow.checked_out_at;
  const finalUpdatedAt = transition.updates.updated_at ?? new Date().toISOString();

  const finalCheckedInAt = finalCheckedInAtRaw ?? null;
  const finalCheckedOutAt = finalCheckedOutAtRaw ?? null;

  const historyRecord = transition.history;
  if (!historyRecord) {
    console.error("[ops][booking-check-in] missing history payload for transition");
    return NextResponse.json({ error: "Unable to record booking transition" }, { status: 500 });
  }

  const { data: transitionResult, error: transitionError } = await serviceSupabase.rpc("apply_booking_state_transition", {
    p_booking_id: bookingRow.id,
    p_status: targetStatus,
    p_checked_in_at: finalCheckedInAt,
    p_checked_out_at: finalCheckedOutAt,
    p_updated_at: finalUpdatedAt,
    p_history_from: historyRecord.from_status ?? bookingRow.status,
    p_history_to: historyRecord.to_status,
    p_history_changed_by: historyRecord.changed_by,
    p_history_changed_at: historyRecord.changed_at,
    p_history_reason: historyRecord.reason,
    p_history_metadata: historyRecord.metadata ?? {},
  });

  if (transitionError) {
    console.error("[ops][booking-check-in] failed to persist transition", transitionError.message);
    return NextResponse.json({ error: "Unable to check in booking" }, { status: 500 });
  }

  const resultRow = transitionResult?.[0];
  return NextResponse.json({
    status: resultRow?.status ?? targetStatus,
    checkedInAt: resultRow?.checked_in_at ?? finalCheckedInAt,
    checkedOutAt: resultRow?.checked_out_at ?? finalCheckedOutAt,
  });
}
