import { NextResponse } from "next/server";
import { z } from "zod";

import { assignTablesDirectly, unassignTablesDirect, DirectAssignmentError } from "@/server/capacity/table-assignment/direct-assignment";
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";
import { enqueueBookingUpdatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";

import type { NextRequest } from "next/server";
import type { BookingRecord } from "@/server/bookings";

const assignSchema = z.object({
  tableIds: z.array(z.string().uuid()).min(1, "At least one table must be selected"),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
  requireAdjacency: z.boolean().optional(),
});

const unassignSchema = z.object({
  tableIds: z.array(z.string().uuid()).min(1, "At least one table must be selected"),
});

/**
 * POST /api/ops/bookings/{id}/assign-tables
 *
 * Atomically assign tables to a booking in a single operation.
 * This is a simplified alternative to the session-based manual assignment flow.
 *
 * Features:
 * - Single atomic operation (no holds, no sessions)
 * - Built-in idempotency
 * - Clear validation and error messages
 * - Fast and reliable
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params;

  // === Authentication ===
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // === Parse Request Body ===
  const body = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        code: "INVALID_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { tableIds, idempotencyKey, requireAdjacency } = parsed.data;

  // === Authorization - Check restaurant access ===
  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return NextResponse.json(
      { error: "Failed to load booking", code: "BOOKING_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  const bookingRow = bookingLookup.data;
  if (!bookingRow?.restaurant_id) {
    return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", bookingRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    return NextResponse.json(
      { error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  // === Execute Assignment ===
  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  const { data: previousBooking, error: previousError } = await serviceClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (previousError) {
    console.error("[ops/bookings/assign-tables] failed to load booking before assignment", {
      bookingId,
      error: previousError,
    });
  }

  try {
    const result = await assignTablesDirectly({
      bookingId,
      tableIds,
      idempotencyKey,
      requireAdjacency,
      assignedBy: user.id,
      client: serviceClient,
    });

    if (previousBooking) {
      try {
        const { data: currentBooking, error: currentError } = await serviceClient
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .maybeSingle();

        if (currentError) {
          console.error("[ops/bookings/assign-tables] failed to load booking after assignment", {
            bookingId,
            error: currentError,
          });
        } else if (currentBooking) {
          const prevStatus = (previousBooking as { status?: string | null }).status ?? null;
          const currStatus = (currentBooking as { status?: string | null }).status ?? null;

          if (
            (prevStatus === "pending" || prevStatus === "pending_allocation") &&
            currStatus === "confirmed"
          ) {
            await enqueueBookingUpdatedSideEffects(
              {
                previous: safeBookingPayload(previousBooking as BookingRecord),
                current: safeBookingPayload(currentBooking as BookingRecord),
                restaurantId: currentBooking.restaurant_id ?? bookingRow.restaurant_id,
              },
              { supabase: serviceClient },
            );
          }
        }
      } catch (jobError) {
        console.error("[ops/bookings/assign-tables] side effects failed", jobError);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof DirectAssignmentError) {
      console.error("[ops/bookings/assign-tables] validation error", {
        code: error.code,
        message: error.message,
        details: error.details,
        bookingId,
        tableIds,
      });
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.status },
      );
    }

    // Log the full error for debugging
    console.error("[ops/bookings/assign-tables] unexpected error", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      bookingId,
      tableIds,
      userId: user.id,
    });

    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * DELETE /api/ops/bookings/{id}/assign-tables
 *
 * Remove table assignments from a booking.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params;

  // === Authentication ===
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // === Parse Request Body ===
  const body = await req.json().catch(() => null);
  const parsed = unassignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        code: "INVALID_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { tableIds } = parsed.data;

  // === Authorization - Check restaurant access ===
  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return NextResponse.json(
      { error: "Failed to load booking", code: "BOOKING_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  const bookingRow = bookingLookup.data;
  if (!bookingRow?.restaurant_id) {
    return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", bookingRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    return NextResponse.json(
      { error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  // === Execute Unassignment ===
  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  try {
    const result = await unassignTablesDirect({
      bookingId,
      tableIds,
      client: serviceClient,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof DirectAssignmentError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.status },
      );
    }

    console.error("[ops/bookings/unassign-tables] unexpected error", {
      error,
      bookingId,
      tableIds,
      userId: user.id,
    });

    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
