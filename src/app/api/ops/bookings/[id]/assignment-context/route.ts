import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { getServiceSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";
import { toIsoUtc } from "@/server/capacity/table-assignment/utils";
import { buildBusyMaps, extractConflictsForTables } from "@/server/capacity/table-assignment/availability";
import { computeBookingWindowWithFallback } from "@/server/capacity/table-assignment/booking-window";
import { getVenuePolicy } from "@/server/capacity/policy";


import type { NextRequest } from "next/server";

/**
 * GET /api/ops/bookings/{id}/assignment-context
 *
 * A simplified context endpoint for the direct assignment UI.
 * It provides the necessary data to render the floor plan and its state for a given booking.
 * This replaces the legacy `manual-context` endpoint.
 */
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const bookingId = params.id;

  // For service-level routes, we use a service client that has broader permissions
  // to read data needed for generating context, like all tables and potentially conflicting bookings.
  // The initial RLS-restricted client is not sufficient here.
  // We will derive the restaurant_id from the booking itself to scope the service client.

  const serviceSupabase = getServiceSupabaseClient();

  // 1. Load the target booking to get its restaurant_id and time window
  const bookingQuery = await serviceSupabase
    .from("bookings")
    .select("id, restaurant_id, start_at, booking_date, start_time, party_size, status")
    .eq("id", bookingId)
    .single();

  if (bookingQuery.error || !bookingQuery.data) {
    return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }
  const booking = bookingQuery.data;
  const restaurantId = booking.restaurant_id;

  // Create a restaurant-scoped service client for subsequent queries
  const restaurantClient = getTenantServiceSupabaseClient(restaurantId);

  // 2. Compute the booking's time window
  const policy = getVenuePolicy(); // Using default policy
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  // 3. Load all necessary data in parallel
  const [tablesResult, contextBookingsResult, bookingAssignmentsResult] = await Promise.all([
    restaurantClient.from("table_inventory").select("*"),
    restaurantClient
      .from("bookings")
      .select("id, start_at, end_at, status, party_size, start_time, end_time, booking_date, booking_table_assignments(table_id)")
      .eq("booking_date", booking.booking_date),
    restaurantClient.from("booking_table_assignments").select("table_id").eq("booking_id", bookingId),
  ]);

  if (tablesResult.error || contextBookingsResult.error || bookingAssignmentsResult.error) {
    // Basic error handling, can be made more granular
    return NextResponse.json({ error: "Failed to load assignment context", code: "CONTEXT_LOAD_FAILED" }, { status: 500 });
  }

  const tables = tablesResult.data;
  const contextBookings = contextBookingsResult.data;
  const bookingAssignments = bookingAssignmentsResult.data.map(a => a.table_id);

  // 4. Calculate conflicts
  // Note: The old context included holds, but the new direct-assignment model deprecates them.
  // We only need to build the busy map from other confirmed/checked_in bookings.
  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings.map(b => ({
      ...b,
      // Ensure the structure matches what buildBusyMaps expects
      // ContextBookingRow expects booking_table_assignments, which we fetched.
      // The query returns it as an array of objects, which matches the type.
    })),
    holds: [], // No holds in the new system
    policy,
    targetWindow: window,
  });

  const conflicts = extractConflictsForTables(
    busy,
    tables.map((table) => table.id),
    window,
  );

  // 5. Construct the response payload
  const context = {
    booking,
    tables,
    conflicts,
    bookingAssignments,
    // The new context is much simpler. No complex versioning.
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
    serverNow: toIsoUtc(DateTime.now()),
  };

  return NextResponse.json(context, { status: 200 });
}
