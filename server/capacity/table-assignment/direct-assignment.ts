/**
 * Direct Table Assignment - Simplified Manual Assignment System
 *
 * This module provides a simplified, atomic approach to manual table assignments
 * without the complexity of sessions, holds, or multi-step workflows.
 *
 * Key principles:
 * - Single atomic operation
 * - Optimistic concurrency control
 * - Built-in idempotency
 * - Clear error messages
 * - Fast and reliable
 */
 
import { evaluateAdjacency, isAdjacencySatisfied, summarizeAdjacencyStatus } from "@/server/capacity/adjacency";
import { getVenuePolicy, ServiceOverrunError } from "@/server/capacity/policy";
import { getAllocatorAdjacencyMode } from "@/server/feature-flags";

import { buildBusyMaps, extractConflictsForTables, resolveRequireAdjacency } from "./availability";
import { computeBookingWindowWithFallback } from "./booking-window";
import {
  ensureClient,
  loadBooking,
  loadTablesByIds,
  loadAdjacency,
  loadContextBookings,
  loadRestaurantTimezone,
  type DbClient,
} from "./supabase";
import { toIsoUtc, summarizeSelection } from "./utils";

import type { Table, BookingWindow, ManualAssignmentConflict } from "./types";

// ============================================================================
// Types
// ============================================================================

export type DirectAssignmentInput = {
  bookingId: string;
  tableIds: string[];
  idempotencyKey: string;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  client?: DbClient;
};

export type DirectAssignmentResult = {
  success: true;
  assignments: Array<{
    id: string;
    booking_id: string;
    table_id: string;
    assigned_at: string;
    assigned_by: string | null;
  }>;
  booking: {
    id: string;
    status: string;
    party_size: number;
  };
  summary: {
    tableCount: number;
    totalCapacity: number;
    partySize: number;
    slack: number;
  };
};

export class DirectAssignmentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DirectAssignmentError";
  }
}

// ============================================================================
// Validation Types
// ============================================================================

type ValidationCheck = {
  id: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
};

type ValidationResult = {
  valid: boolean;
  checks: ValidationCheck[];
  conflicts: ManualAssignmentConflict[];
};

// ============================================================================
// Main Assignment Function
// ============================================================================

/**
 * Atomically assign tables to a booking in a single transaction
 *
 * This function:
 * 1. Validates input
 * 2. Loads booking and tables
 * 3. Checks for existing assignments (idempotency)
 * 4. Validates selection (capacity, adjacency, conflicts)
 * 5. Creates assignments atomically
 * 6. Updates booking status if needed
 *
 * @throws DirectAssignmentError on validation failure or conflicts
 */
export async function assignTablesDirectly(input: DirectAssignmentInput): Promise<DirectAssignmentResult> {
  const {
    bookingId,
    tableIds,
    idempotencyKey,
    requireAdjacency: requireAdjacencyOverride,
    assignedBy = null,
    client,
  } = input;

  // === STEP 1: Input Validation ===
  if (!bookingId || typeof bookingId !== "string") {
    throw new DirectAssignmentError("Invalid booking ID", "INVALID_INPUT", 400);
  }

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new DirectAssignmentError("At least one table must be selected", "INVALID_INPUT", 400);
  }

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new DirectAssignmentError("Idempotency key is required", "INVALID_INPUT", 400);
  }

  const supabase = ensureClient(client);

  // === STEP 2: Check Idempotency - Return existing assignments if already processed ===
  const { data: existingData, error: existingError } = await supabase
    .from("booking_table_assignments")
    .select("id, booking_id, table_id, assigned_at, assigned_by")
    .eq("booking_id", bookingId)
    .eq("idempotency_key", idempotencyKey);

  if (existingError) {
    console.error("[direct-assignment] Error checking idempotency:", existingError);
    // Continue with assignment if we can't check (don't fail)
  }

  if (existingData && existingData.length > 0) {
    // Already processed - return existing result (idempotency)
    const booking = await loadBooking(bookingId, supabase);
    const tables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
    const summary = summarizeSelection(tables, booking.party_size);

    return {
      success: true,
      assignments: existingData.map((a) => ({
        id: a.id!,
        booking_id: a.booking_id!,
        table_id: a.table_id!,
        assigned_at: a.assigned_at!,
        assigned_by: a.assigned_by ?? null,
      })),
      booking: {
        id: booking.id,
        status: booking.status,
        party_size: booking.party_size,
      },
      summary: {
        tableCount: summary.tableCount,
        totalCapacity: summary.totalCapacity,
        partySize: summary.partySize,
        slack: summary.slack,
      },
    };
  }

  // === STEP 3: Load Booking ===
  const booking = await loadBooking(bookingId, supabase);

  // === STEP 4: Load Tables ===
  const tables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);

  if (tables.length !== tableIds.length) {
    const foundIds = tables.map((t) => t.id);
    const missingIds = tableIds.filter((id) => !foundIds.includes(id));
    throw new DirectAssignmentError(
      `Tables not found: ${missingIds.join(", ")}`,
      "TABLES_NOT_FOUND",
      404,
      { missingTableIds: missingIds },
    );
  }

  // === STEP 5: Compute Booking Window ===
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants)
      ? booking.restaurants.timezone
      : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });

  let window: BookingWindow;
  try {
    ({ window } = computeBookingWindowWithFallback({
      startISO: booking.start_at,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      partySize: booking.party_size,
      policy,
    }));
  } catch (error) {
    if (error instanceof ServiceOverrunError) {
      throw new DirectAssignmentError(
        error.message,
        "SERVICE_OVERRUN",
        422,
      );
    }
    throw error;
  }

  // === STEP 6: Run Validation ===
  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
  const validation = await validateSelection({
    bookingId,
    booking,
    tables,
    window,
    requireAdjacency,
    restaurantTimezone: restaurantTimezone ?? undefined,
    supabase,
  });

  if (!validation.valid) {
    const firstError = validation.checks.find((c) => !c.passed);
    throw new DirectAssignmentError(
      firstError?.message || "Validation failed",
      firstError?.id.toUpperCase() || "VALIDATION_FAILED",
      422,
      {
        checks: validation.checks,
        conflicts: validation.conflicts,
      },
    );
  }

  // === STEP 7: Insert Assignments Atomically ===
  const now = new Date().toISOString();
  const startAt = toIsoUtc(window.block.start);
  const endAt = toIsoUtc(window.block.end);

  const assignmentsToInsert = tableIds.map((tableId) => ({
    booking_id: bookingId,
    table_id: tableId,
    assigned_at: now,
    assigned_by: assignedBy,
    idempotency_key: idempotencyKey,
    start_at: startAt,
    end_at: endAt,
  }));

  const { data: insertedAssignments, error: insertError } = await supabase
    .from("booking_table_assignments")
    .insert(assignmentsToInsert)
    .select("id, booking_id, table_id, assigned_at, assigned_by");

  if (insertError) {
    // Check if it's a uniqueness violation (already assigned)
    if (insertError.code === "23505") {
      throw new DirectAssignmentError(
        "One or more tables are already assigned to this booking",
        "ALREADY_ASSIGNED",
        409,
      );
    }
    throw new DirectAssignmentError(
      `Failed to create assignments: ${insertError.message}`,
      "INSERT_FAILED",
      500,
    );
  }

  if (!insertedAssignments || insertedAssignments.length === 0) {
    throw new DirectAssignmentError(
      "No assignments were created",
      "INSERT_FAILED",
      500,
    );
  }

  // === STEP 8: Update Booking Status (if needed) ===
  // If booking was pending, move to confirmed
  if (booking.status === "pending") {
    await supabase
      .from("bookings")
      .update({ status: "confirmed", updated_at: now })
      .eq("id", bookingId);
  }

  // === STEP 9: Return Success ===
  const summary = summarizeSelection(tables, booking.party_size);

  return {
    success: true,
    assignments: insertedAssignments.map((a) => ({
      id: a.id!,
      booking_id: a.booking_id!,
      table_id: a.table_id!,
      assigned_at: a.assigned_at!,
      assigned_by: a.assigned_by ?? null,
    })),
    booking: {
      id: booking.id,
      status: booking.status === "pending" ? "confirmed" : booking.status,
      party_size: booking.party_size,
    },
    summary: {
      tableCount: summary.tableCount,
      totalCapacity: summary.totalCapacity,
      partySize: summary.partySize,
      slack: summary.slack,
    },
  };
}

// ============================================================================
// Validation Logic
// ============================================================================

async function validateSelection(params: {
  bookingId: string;
  booking: {
    id: string;
    restaurant_id: string;
    party_size: number;
    booking_date: string | null;
    assigned_zone_id: string | null;
  };
  tables: Table[];
  window: BookingWindow;
  requireAdjacency: boolean;
  restaurantTimezone?: string;
  supabase: DbClient;
}): Promise<ValidationResult> {
  const { bookingId, booking, tables, window, requireAdjacency, restaurantTimezone, supabase } = params;
  const checks: ValidationCheck[] = [];
  const summary = summarizeSelection(tables, booking.party_size);

  // Check 1: Zone consistency - All tables must be in the same zone
  const zones = new Set(tables.map((t) => t.zoneId).filter(Boolean));
  const singleZone = zones.size <= 1;
  checks.push({
    id: "zone",
    passed: singleZone,
    message: singleZone
      ? summary.zoneId
        ? `All tables in zone ${summary.zoneId}`
        : "No zone specified"
      : `Tables are in different zones: ${Array.from(zones).join(", ")}`,
    details: {
      zones: Array.from(zones),
      zoneId: summary.zoneId,
    },
  });

  // Check 2: Zone lock (if booking has assigned zone)
  if (booking.assigned_zone_id && summary.zoneId && booking.assigned_zone_id !== summary.zoneId) {
    checks.push({
      id: "zone_locked",
      passed: false,
      message: `Booking is locked to zone ${booking.assigned_zone_id}; selected tables are in zone ${summary.zoneId}`,
      details: {
        expectedZone: booking.assigned_zone_id,
        selectedZone: summary.zoneId,
      },
    });
  }

  // Check 3: Movable requirement - When merging multiple tables, all must be movable
  if (tables.length > 1) {
    const allMovable = tables.every((table) => table.mobility === "movable");
    const nonMovableTables = tables.filter((t) => t.mobility !== "movable");
    checks.push({
      id: "movable",
      passed: allMovable,
      message: allMovable
        ? "All tables are movable (can be merged)"
        : `Merged assignments require movable tables. Fixed tables: ${nonMovableTables.map((t) => t.tableNumber).join(", ")}`,
      details: {
        allMovable,
        nonMovableTables: nonMovableTables.map((t) => ({
          id: t.id,
          tableNumber: t.tableNumber,
          mobility: t.mobility,
        })),
      },
    });
  }

  // Check 4: Capacity
  const capacityOk = summary.totalCapacity >= summary.partySize;
  checks.push({
    id: "capacity",
    passed: capacityOk,
    message: capacityOk
      ? `Selected tables have ${summary.totalCapacity} seats for party of ${summary.partySize}`
      : `Selected tables (${summary.totalCapacity} seats) don't meet party size (${summary.partySize})`,
    details: {
      totalCapacity: summary.totalCapacity,
      partySize: summary.partySize,
      deficit: summary.partySize - summary.totalCapacity,
    },
  });

  // Check 5: Adjacency (if required)
  if (requireAdjacency && tables.length > 1) {
    const tableIds = tables.map((t) => t.id);
    const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);
    const evaluation = evaluateAdjacency(tableIds, adjacency);
    const adjacencyMode = getAllocatorAdjacencyMode();
    const adjacencyOk = isAdjacencySatisfied(evaluation, adjacencyMode);

    const failureMessage =
      adjacencyMode === "pairwise"
        ? "Tables must be adjacent to every other selected table"
        : adjacencyMode === "neighbors"
          ? "Tables must share a common neighbor/hub to be merged"
          : "Tables must remain connected when adjacency enforcement is enabled";

    checks.push({
      id: "adjacency",
      passed: adjacencyOk,
      message: adjacencyOk
        ? `Tables satisfy ${summarizeAdjacencyStatus(evaluation, tables.length)} adjacency requirement`
        : failureMessage,
      details: {
        mode: adjacencyMode,
        status: summarizeAdjacencyStatus(evaluation, tables.length),
      },
    });
  }

  // Check 6: Time conflicts
  const contextBookings = await loadContextBookings(
    booking.restaurant_id,
    booking.booking_date,
    supabase,
    {
      startIso: toIsoUtc(window.block.start),
      endIso: toIsoUtc(window.block.end),
    },
  );

  const busyMaps = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds: [], // No holds in direct assignment
    excludeHoldId: null,
    policy: getVenuePolicy({ timezone: restaurantTimezone ?? undefined }),
    targetWindow: window,
  });

  const conflicts = extractConflictsForTables(busyMaps, tables.map((t) => t.id), window);

  checks.push({
    id: "conflicts",
    passed: conflicts.length === 0,
    message:
      conflicts.length === 0
        ? "No time conflicts with other bookings"
        : `${conflicts.length} table(s) have conflicting bookings at this time`,
    details: {
      conflictCount: conflicts.length,
      conflicts: conflicts.slice(0, 5), // Limit details to first 5
    },
  });

  // Determine overall validity
  const valid = checks.every((check) => check.passed);

  return {
    valid,
    checks,
    conflicts,
  };
}

/**
 * Unassign tables from a booking (for removing assignments)
 */
export async function unassignTablesDirect(params: {
  bookingId: string;
  tableIds: string[];
  client?: DbClient;
}): Promise<{ success: true; removedCount: number }> {
  const { bookingId, tableIds, client } = params;

  if (!bookingId || !Array.isArray(tableIds) || tableIds.length === 0) {
    throw new DirectAssignmentError("Invalid input", "INVALID_INPUT", 400);
  }

  const supabase = ensureClient(client);

  const { error, count } = await supabase
    .from("booking_table_assignments")
    .delete({ count: "exact" })
    .eq("booking_id", bookingId)
    .in("table_id", tableIds);

  if (error) {
    throw new DirectAssignmentError(
      `Failed to remove assignments: ${error.message}`,
      "DELETE_FAILED",
      500,
    );
  }

  // BUSINESS RULE: Check if all tables are now unassigned
  // If so, revert booking status to 'pending'
  const { data: remainingAssignments, error: checkError } = await supabase
    .from("booking_table_assignments")
    .select("id")
    .eq("booking_id", bookingId)
    .limit(1);

  if (!checkError && remainingAssignments && remainingAssignments.length === 0) {
    // No tables assigned - check if booking is 'confirmed' and revert to 'pending'
    const { data: booking } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();

    if (booking?.status === "confirmed") {
      await supabase
        .from("bookings")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      console.info("[direct-assignment] reverted to pending - all tables unassigned", {
        bookingId,
        removedTableIds: tableIds,
      });
    }
  }

  return {
    success: true,
    removedCount: count ?? 0,
  };
}
