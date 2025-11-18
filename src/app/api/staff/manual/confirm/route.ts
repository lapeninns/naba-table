import { NextResponse } from "next/server";
import { z } from "zod";

import { mapAssignTablesErrorToHttp } from "@/app/api/staff/_utils/assign-tables-error";
import { AssignTablesRpcError, HoldNotFoundError } from "@/server/capacity/holds";
import { confirmSessionHold, getOrCreateManualSession, SessionConflictError, StaleContextError } from "@/server/capacity/manual-session";
import { emitManualConfirm } from "@/server/capacity/telemetry";
import { sendBookingConfirmationEmail } from "@/server/emails/bookings";
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";
import type { NextRequest } from "next/server";

const confirmPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  holdId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  requireAdjacency: z.boolean().optional(),
  contextVersion: z.string(),
});

const isEmailSuppressed = () =>
  process.env.LOAD_TEST_DISABLE_EMAILS === "true" || process.env.SUPPRESS_EMAILS === "true";

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized", error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid request payload",
        error: "Invalid request payload",
        code: "INVALID_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { bookingId, holdId, idempotencyKey, requireAdjacency, contextVersion } = parsed.data;

  const holdLookup = await supabase
    .from("table_holds")
    .select("restaurant_id, booking_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdLookup.error) {
    console.error("[staff/manual/confirm] hold lookup failed", { holdId, error: holdLookup.error });
    return NextResponse.json(
      { message: "Failed to load hold", error: "Failed to load hold", code: "HOLD_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  const holdRow = holdLookup.data;
  if (!holdRow?.restaurant_id) {
    return NextResponse.json(
      { message: "Hold not found", error: "Hold not found", code: "HOLD_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
    return NextResponse.json(
      {
        message: "Hold belongs to a different booking",
        error: "Hold belongs to a different booking",
        code: "HOLD_BOOKING_MISMATCH",
      },
      { status: 409 },
    );
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", holdRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    console.error("[staff/manual/confirm] membership lookup failed", { holdId, error: membership.error });
    return NextResponse.json(
      { message: "Failed to verify access", error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  if (!membership.data) {
    return NextResponse.json(
      { message: "Access denied", error: "Access denied", code: "ACCESS_DENIED" },
      { status: 403 },
    );
  }

  const serviceClient = getTenantServiceSupabaseClient(holdRow.restaurant_id);

  const bookingLookup = await serviceClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    console.error("[staff/manual/confirm] booking lookup failed", { bookingId, error: bookingLookup.error });
    return NextResponse.json(
      { message: "Failed to load booking", error: "Failed to load booking", code: "BOOKING_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  const bookingRow = (bookingLookup.data ?? null) as BookingRecord | null;
  if (!bookingRow) {
    return NextResponse.json(
      { message: "Booking not found", error: "Booking not found", code: "BOOKING_NOT_FOUND" },
      { status: 404 },
    );
  }
  const alreadyConfirmed = bookingRow.status === "confirmed";

  const session = await getOrCreateManualSession({
    bookingId,
    restaurantId: holdRow.restaurant_id,
    createdBy: user.id,
    client: serviceClient,
  });

  try {
    const result = await confirmSessionHold({
      sessionId: session.id,
      bookingId,
      restaurantId: holdRow.restaurant_id,
      holdId,
      idempotencyKey,
      requireAdjacency,
      contextVersion,
      selectionVersion: session.selectionVersion,
      assignedBy: user.id,
      client: serviceClient,
    });

    const contextAdjacencyRequired = Boolean(result.context.flags?.adjacencyRequired ?? null);

    await emitManualConfirm({
      ok: true,
      bookingId,
      restaurantId: holdRow.restaurant_id,
      policyVersion: result.context.policyVersion ?? null,
      adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === "boolean" ? requireAdjacency : null),
    });

    if (!isEmailSuppressed() && !alreadyConfirmed) {
      try {
        const refreshed = await serviceClient
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .maybeSingle();

        if (refreshed.error) {
          console.error("[staff/manual/confirm] failed to reload booking for email", {
            bookingId,
            error: refreshed.error,
          });
        } else {
          const updatedBooking = (refreshed.data ?? null) as BookingRecord | null;
          if (!updatedBooking) {
            console.warn("[staff/manual/confirm] booking disappeared before email send", { bookingId });
          } else if (updatedBooking.status === "confirmed" && updatedBooking.customer_email) {
            await sendBookingConfirmationEmail(updatedBooking);
          }
        }
      } catch (error) {
        console.error("[staff/manual/confirm] failed to send confirmation email", { bookingId, error });
      }
    }

    return NextResponse.json({ assignments: result.assignments, session: result.session, context: result.context });
  } catch (error) {
    if (error instanceof HoldNotFoundError) {
      return NextResponse.json({ message: error.message, error: error.message, code: "HOLD_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof StaleContextError) {
      return NextResponse.json(
        {
          message: error.message,
          error: error.message,
          code: "STALE_CONTEXT",
          details: { expected: error.expected, provided: error.provided },
        },
        { status: 409 },
      );
    }
    if (error instanceof SessionConflictError) {
      return NextResponse.json(
        { message: error.message, error: error.message, code: error.code, details: error.details },
        { status: 409 },
      );
    }
    if (error instanceof AssignTablesRpcError) {
      const { status, payload } = mapAssignTablesErrorToHttp(error);
      return NextResponse.json(payload, { status });
    }
    console.error("[staff/manual/confirm] unexpected error", { error, bookingId, userId: user.id });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ message, error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
