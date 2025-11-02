import { NextResponse } from "next/server";
import { z } from "zod";

import { prepareCheckInTransition, prepareNoShowTransition } from "@/server/ops/booking-lifecycle/actions";
import { BookingLifecycleError } from "@/server/ops/booking-lifecycle/stateMachine";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";

import type { Tables } from "@/types/supabase";
import type { NextRequest} from "next/server";

const bodySchema = z.object({
  status: z.enum(["completed", "no_show"]),
});

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

async function resolveBookingId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === "string") return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops][booking-status] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select("id, restaurant_id, status, checked_in_at, checked_out_at, booking_date, start_time")
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error("[ops][booking-status] failed to load booking", bookingError.message);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const bookingRow = booking as Tables<"bookings"> | null;

  if (!bookingRow) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    const memberships = await fetchUserMemberships(user.id, tenantSupabase);
    const hasAccess = memberships.some((membership) => membership.restaurant_id === bookingRow.restaurant_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("[ops][booking-status] membership lookup failed", error);
    return NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 });
  }

  try {
    const transition =
      payload.status === "no_show"
        ? prepareNoShowTransition({
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
          })
        : prepareCheckInTransition({
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

    if (transition.skipUpdate) {
      return NextResponse.json({
        status: transition.response.status,
      });
    }

    const historyRecord = transition.history;
    if (!historyRecord) {
      console.error("[ops][booking-status] missing history payload for transition");
      return NextResponse.json({ error: "Unable to record booking transition" }, { status: 500 });
    }

    const targetStatus = (transition.updates.status ?? bookingRow.status) as Tables<"bookings">["status"];
    const finalCheckedInAt =
      transition.updates.checked_in_at !== undefined ? transition.updates.checked_in_at ?? null : bookingRow.checked_in_at ?? null;
    const finalCheckedOutAt =
      transition.updates.checked_out_at !== undefined ? transition.updates.checked_out_at ?? null : bookingRow.checked_out_at ?? null;
    const finalUpdatedAt = transition.updates.updated_at ?? new Date().toISOString();

    const { data: transitionResult, error: transitionError } = await serviceSupabase.rpc("apply_booking_state_transition", {
      p_booking_id: bookingRow.id,
      p_status: targetStatus,
      p_checked_in_at: finalCheckedInAt,
      p_checked_out_at: finalCheckedOutAt,
      p_updated_at: finalUpdatedAt,
      p_history_from: historyRecord.from_status ?? bookingRow.status,
      p_history_to: historyRecord.to_status,
      p_history_changed_by: historyRecord.changed_by ?? null,
      p_history_changed_at: historyRecord.changed_at ?? finalUpdatedAt,
      p_history_reason: historyRecord.reason ?? "status_change",
      p_history_metadata: historyRecord.metadata ?? {},
    });

    if (transitionError) {
      console.error("[ops][booking-status] failed to persist transition", transitionError.message);
      return NextResponse.json({ error: "Unable to update booking" }, { status: 500 });
    }

    const resultRow = transitionResult?.[0];

    return NextResponse.json({
      status: resultRow?.status ?? targetStatus,
    });
  } catch (validationError) {
    if (validationError instanceof BookingLifecycleError) {
      const statusCode = validationError.code === "TIMESTAMP_INVALID" ? 400 : 409;
      return NextResponse.json({ error: validationError.message }, { status: statusCode });
    }
    console.error("[ops][booking-status] unexpected validation error", validationError);
    return NextResponse.json({ error: "Unable to update booking" }, { status: 500 });
  }
}
