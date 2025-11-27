import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingTableAssignments, unassignTableFromBooking } from "@/server/capacity";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest} from "next/server";

const idsSchema = z.object({
  bookingId: z.string().uuid(),
  tableId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string; tableId: string }>;
};

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const rawBookingId = normalizeParam(params.id);
  const rawTableId = normalizeParam(params.tableId);

  const parsedParams = idsSchema.safeParse({ bookingId: rawBookingId, tableId: rawTableId });
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 });
  }

  const { bookingId, tableId } = parsedParams.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops][bookings][unassign-table] auth error", authError.message);
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
    console.error("[ops][bookings][unassign-table] failed to load booking", bookingError.message);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: booking.restaurant_id });
  } catch (accessError) {
    console.error("[ops][bookings][unassign-table] access denied", accessError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    await unassignTableFromBooking(bookingId, tableId, serviceClient);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to unassign table";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Check remaining table assignments
  let tableAssignments;
  try {
    tableAssignments = await getBookingTableAssignments(bookingId, serviceClient);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load table assignments";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // BUSINESS RULE: If all tables are unassigned, revert status to 'pending'
  // A booking with zero tables should not be 'confirmed'
  if (tableAssignments.length === 0) {
    const { data: currentBooking } = await serviceClient
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();

    if (currentBooking?.status === "confirmed") {
      await serviceClient
        .from("bookings")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      console.info("[ops][bookings][unassign-table] reverted to pending - no tables assigned", {
        bookingId,
        removedTableId: tableId,
      });
    }
  }

  return NextResponse.json({ tableAssignments });
}
