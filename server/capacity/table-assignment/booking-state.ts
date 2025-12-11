import { applyAbortSignal, releaseHoldWithRetry, type DbClient } from "./supabase";

import type { Tables } from "@/types/supabase";

export type BookingAssignmentState = {
  bookingState: Tables<"bookings">["status"] | null;
  assignmentCount: number;
  restaurantId: string | null;
};

export async function fetchBookingAssignmentState(params: {
  bookingId: string;
  client: DbClient;
  signal?: AbortSignal;
}): Promise<BookingAssignmentState> {
  const { bookingId, client, signal } = params;

  const bookingQuery = applyAbortSignal(
    client.from("bookings").select("status, restaurant_id").eq("id", bookingId),
    signal,
  );
  const { data: bookingRow } = await bookingQuery.maybeSingle();

  const assignmentsQuery = applyAbortSignal(
    client
      .from("booking_table_assignments")
      .select("table_id", { count: "exact", head: true })
      .eq("booking_id", bookingId),
    signal,
  );
  const { count: assignmentCount } = await assignmentsQuery;

  return {
    bookingState: (bookingRow?.status as Tables<"bookings">["status"] | null) ?? null,
    assignmentCount: typeof assignmentCount === "number" ? assignmentCount : 0,
    restaurantId: (bookingRow?.restaurant_id as string | null) ?? null,
  };
}

export async function reconcileOrphanedAssignments(params: {
  bookingId: string;
  holdId?: string;
  client: DbClient;
  signal?: AbortSignal;
}): Promise<void> {
  const { bookingId, holdId, client, signal } = params;

  const assignmentLookup = applyAbortSignal(
    client.from("booking_table_assignments").select("table_id").eq("booking_id", bookingId),
    signal,
  );
  const { data: assignmentRows } = await assignmentLookup;
  const tableIds = (assignmentRows ?? [])
    .map((row) => row.table_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (tableIds.length > 0) {
    try {
      await client.rpc("unassign_tables_atomic", {
        p_booking_id: bookingId,
        p_table_ids: tableIds,
      });
    } catch (unassignError) {
      console.warn("[capacity.atomic] failed to unassign tables during reconciliation", {
        bookingId,
        tableIds,
        error: unassignError instanceof Error ? unassignError.message : String(unassignError),
      });
    }
  }

  if (holdId) {
    try {
      await releaseHoldWithRetry({ holdId, client });
    } catch (releaseError) {
      console.warn("[capacity.atomic] failed to release hold during reconciliation", {
        holdId,
        bookingId,
        error: releaseError instanceof Error ? releaseError.message : String(releaseError),
      });
    }
  }
}
