import { NextResponse } from "next/server";
import { z } from "zod";

import { HoldConflictError } from "@/server/capacity/holds";
import { quoteTablesForBooking } from "@/server/capacity/tables";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const quotePayloadSchema = z.object({
  bookingId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  maxTables: z.number().int().min(1).max(5).optional(),
  requireAdjacency: z.boolean().optional(),
  avoidTables: z.array(z.string().uuid()).optional(),
  holdTtlSeconds: z.number().int().min(30).max(600).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = quotePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { bookingId, zoneId, maxTables, requireAdjacency, avoidTables, holdTtlSeconds } = parsed.data;

  const bookingLookup = await supabase
    .from("bookings")
    .select("id, restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return NextResponse.json({ error: bookingLookup.error.message }, { status: 500 });
  }

  const bookingRow = bookingLookup.data;
  if (!bookingRow || !bookingRow.restaurant_id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", bookingRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    return NextResponse.json({ error: membership.error.message }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const serviceClient = getServiceSupabaseClient();
    const result = await quoteTablesForBooking({
      bookingId,
      zoneId,
      maxTables,
      requireAdjacency,
      avoidTables,
      holdTtlSeconds,
      createdBy: user.id,
      client: serviceClient,
    });

    if (result.reason && !result.hold) {
      return NextResponse.json(
        {
          holdId: null,
          expiresAt: null,
          candidate: null,
          alternates: result.alternates,
          nextTimes: result.nextTimes,
          reason: result.reason,
        },
        { status: 200 },
      );
    }

    if (!result.hold || !result.candidate) {
      return NextResponse.json(
        {
          error: "Quote failed",
          details: result.reason ?? "No candidate returned",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      holdId: result.hold.id,
      expiresAt: result.hold.expiresAt,
      window: {
        start: result.hold.startAt,
        end: result.hold.endAt,
      },
      candidate: result.candidate,
      alternates: result.alternates,
      nextTimes: result.nextTimes,
      zoneId: result.hold.zoneId,
      requireAdjacency: requireAdjacency ?? null,
    });
  } catch (error) {
    if (error instanceof HoldConflictError) {
      return NextResponse.json(
        {
          error: "Hold conflict",
          holdId: error.holdId ?? null,
        },
        { status: 409 },
      );
    }

    console.error("[staff/auto/quote] unexpected error", { error, bookingId });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
