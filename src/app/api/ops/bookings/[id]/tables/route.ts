import { NextResponse } from "next/server";
import { z } from "zod";

import { assignTableToBooking, getBookingTableAssignments } from "@/server/capacity";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest} from "next/server";

const assignTableSchema = z.object({
  tableId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: bookingId } = await context.params;

  if (!bookingId || !z.string().uuid().safeParse(bookingId).success) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = assignTableSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops][bookings][assign-table] auth error", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("[ops][bookings][assign-table] failed to load booking", bookingError.message);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: booking.restaurant_id });
  } catch (accessError) {
    console.error("[ops][bookings][assign-table] access denied", accessError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();
  const idempotencyKey = request.headers.get("Idempotency-Key");

  try {
    await assignTableToBooking(bookingId, parsedBody.data.tableId, user.id, serviceClient, {
      idempotencyKey: idempotencyKey?.trim() || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign table";
    const normalized = message.toLowerCase();
    let status = 409;
    if (normalized.includes("not found")) {
      status = 404;
    } else if (normalized.includes("allocations_no_overlap")) {
      status = 409;
    }
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const tableAssignments = await getBookingTableAssignments(bookingId, serviceClient);
    return NextResponse.json({ tableAssignments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load table assignments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
