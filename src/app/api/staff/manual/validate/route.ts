import { NextResponse } from "next/server";
import { z } from "zod";

import { ManualSelectionInputError, evaluateManualSelection } from "@/server/capacity/tables";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const validatePayloadSchema = z.object({
  bookingId: z.string().uuid(),
  tableIds: z.array(z.string().uuid()).min(1),
  requireAdjacency: z.boolean().optional(),
  excludeHoldId: z.string().uuid().optional(),
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
  const parsed = validatePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { bookingId, tableIds, requireAdjacency, excludeHoldId } = parsed.data;

  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    console.error("[staff/manual/validate] booking lookup failed", { bookingId, error: bookingLookup.error });
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
    console.error("[staff/manual/validate] membership lookup failed", { bookingId, error: membership.error });
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    const validation = await evaluateManualSelection({
      bookingId,
      tableIds,
      requireAdjacency,
      excludeHoldId,
      client: serviceClient,
    });

    return NextResponse.json({
      ok: validation.ok,
      checks: validation.checks,
      summary: validation.summary,
    });
  } catch (error) {
    if (error instanceof ManualSelectionInputError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("[staff/manual/validate] unexpected error", { error, bookingId, userId: user.id });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
