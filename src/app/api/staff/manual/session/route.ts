import { NextResponse } from "next/server";
import { z } from "zod";

import { computeManualContext, getOrCreateManualSession, ManualSessionDisabledError } from "@/server/capacity/manual-session";
import { ManualSelectionInputError } from "@/server/capacity/table-assignment";
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const createSessionSchema = z.object({
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
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { bookingId } = parsed.data;

  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
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
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }
  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  try {
    const session = await getOrCreateManualSession({
      bookingId,
      restaurantId: bookingRow.restaurant_id,
      createdBy: user.id,
      client: serviceClient,
    });
    const context = await computeManualContext({ bookingId, client: serviceClient });
    return NextResponse.json({
      session,
      context,
    });
  } catch (error) {
    if (error instanceof ManualSessionDisabledError) {
      return NextResponse.json({ error: error.message, code: "SESSION_DISABLED" }, { status: 404 });
    }
    if (error instanceof ManualSelectionInputError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[staff/manual/session] unexpected error", { error, bookingId, userId: user.id });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
