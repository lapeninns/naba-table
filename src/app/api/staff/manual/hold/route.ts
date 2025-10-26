import { NextResponse } from "next/server";
import { z } from "zod";

import { HoldConflictError, releaseTableHold } from "@/server/capacity/holds";
import { ManualSelectionInputError, createManualHold } from "@/server/capacity/tables";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const holdPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  tableIds: z.array(z.string().uuid()).min(1),
  holdTtlSeconds: z.number().int().min(30).max(600).optional(),
  requireAdjacency: z.boolean().optional(),
  excludeHoldId: z.string().uuid().optional(),
});

const holdReleaseSchema = z.object({
  holdId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = holdPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { bookingId, tableIds, holdTtlSeconds, requireAdjacency, excludeHoldId } = parsed.data;

  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    console.error("[staff/manual/hold] booking lookup failed", { bookingId, error: bookingLookup.error });
    return NextResponse.json({ error: "Failed to load booking", code: "BOOKING_LOOKUP_FAILED" }, { status: 500 });
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
    console.error("[staff/manual/hold] membership lookup failed", { bookingId, error: membership.error });
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    const result = await createManualHold({
      bookingId,
      tableIds,
      holdTtlSeconds,
      requireAdjacency,
      excludeHoldId,
      createdBy: user.id,
      client: serviceClient,
    });

    if (!result.hold) {
      return NextResponse.json(
        {
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          validation: result.validation,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      hold: {
        id: result.hold.id,
        expiresAt: result.hold.expiresAt,
        startAt: result.hold.startAt,
        endAt: result.hold.endAt,
        zoneId: result.hold.zoneId,
        tableIds: result.hold.tableIds,
      },
      summary: result.validation.summary,
      validation: result.validation,
    });
  } catch (error) {
    if (error instanceof ManualSelectionInputError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof HoldConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "HOLD_CONFLICT",
          holdId: error.holdId ?? null,
        },
        { status: 409 },
      );
    }

    console.error("[staff/manual/hold] unexpected error", { error, bookingId, userId: user.id });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = holdReleaseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { holdId, bookingId } = parsed.data;

  const holdLookup = await supabase
    .from("table_holds")
    .select("restaurant_id, booking_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdLookup.error) {
    console.error("[staff/manual/hold][delete] hold lookup failed", { holdId, error: holdLookup.error });
    return NextResponse.json({ error: "Failed to load hold", code: "HOLD_LOOKUP_FAILED" }, { status: 500 });
  }

  const holdRow = holdLookup.data;
  if (!holdRow?.restaurant_id) {
    return NextResponse.json({ error: "Hold not found", code: "HOLD_NOT_FOUND" }, { status: 404 });
  }

  if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
    return NextResponse.json(
      { error: "Hold belongs to a different booking", code: "HOLD_BOOKING_MISMATCH" },
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
    console.error("[staff/manual/hold][delete] membership lookup failed", { holdId, error: membership.error });
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    await releaseTableHold({ holdId, client: serviceClient });
    return NextResponse.json({ holdId, released: true });
  } catch (error) {
    console.error("[staff/manual/hold][delete] failed to release hold", { holdId, error });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "RELEASE_FAILED" }, { status: 500 });
  }
}
