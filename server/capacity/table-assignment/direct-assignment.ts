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

import { isTableAssignmentAllowed } from '@/lib/ops/table-assignment-policy';
import {
  evaluateAdjacency,
  isAdjacencySatisfied,
  summarizeAdjacencyStatus,
} from '@/server/capacity/adjacency';
import { AssignTablesRpcError } from '@/server/capacity/holds';
import {
  getVenuePolicy,
  ServiceNotFoundError,
  ServiceOverrunError,
  type TurnBandsByOption,
} from '@/server/capacity/policy';
import { getRestaurantServiceWindows } from '@/server/capacity/service-windows';
import { deriveTableRules } from '@/server/capacity/table-rules';
import { getRestaurantTurnBands } from '@/server/restaurants/turnBands';
import { getAllocatorAdjacencyMode } from '@/server/runtime-policy';

import { assignTableToBooking } from './assignment';
import { buildBusyMaps, extractConflictsForTables } from './availability';
import { computeBookingWindowWithFallback } from './booking-window';
import {
  ensureClient,
  loadBooking,
  loadTablesByIds,
  loadAdjacency,
  loadContextBookings,
  loadRestaurantTimezone,
  type DbClient,
  type BookingRow,
} from './supabase';
import { toIsoUtc, summarizeSelection } from './utils';

import type { Table, BookingWindow, ManualAssignmentConflict } from './types';

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
    this.name = 'DirectAssignmentError';
  }
}

type ExistingAssignmentRow = {
  id: string | null;
  booking_id: string | null;
  table_id: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
};

function mapAtomicAssignmentError(error: AssignTablesRpcError): DirectAssignmentError {
  const normalizedCode = (error.code ?? 'ASSIGNMENT_FAILED').toUpperCase();
  const status =
    normalizedCode.includes('CONFLICT') ||
    normalizedCode.includes('DUPLICATE') ||
    normalizedCode === 'ALREADY_ASSIGNED'
      ? 409
      : normalizedCode.includes('VALIDATION')
        ? 422
        : normalizedCode.includes('NOT_FOUND')
          ? 404
          : 500;

  return new DirectAssignmentError(error.message, normalizedCode, status, {
    details: error.details,
    hint: error.hint,
  });
}

/**
 * Re-reads assignment rows for the (booking_id, idempotency_key) pair.
 *
 * Used by the conflict-recovery path: the up-front idempotency check is a plain
 * read with no DB unique constraint on (booking_id, idempotency_key), so two
 * concurrent same-key requests can both pass it. Whichever loses the
 * (booking_id, table_id) unique constraint at commit must still observe the
 * idempotent result rather than a raw 409.
 *
 * Fails closed: if this lookup itself errors we throw, so the caller surfaces
 * the original conflict instead of fabricating a success from a failed read.
 */
async function loadAssignmentsForIdempotencyKey(params: {
  bookingId: string;
  idempotencyKey: string;
  supabase: DbClient;
}): Promise<ExistingAssignmentRow[]> {
  const { bookingId, idempotencyKey, supabase } = params;
  const { data, error } = await supabase
    .from('booking_table_assignments')
    .select('id, booking_id, table_id, assigned_at, assigned_by')
    .eq('booking_id', bookingId)
    .eq('idempotency_key', idempotencyKey);

  if (error) {
    throw new DirectAssignmentError(
      `Failed to verify idempotent assignment after conflict: ${error.message}`,
      'ASSIGNMENT_SYNC_FAILED',
      500,
    );
  }

  return (data ?? []) as ExistingAssignmentRow[];
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

const PENDING_ASSIGNMENT_STATUSES = new Set(['pending', 'pending_allocation']);

/** apply_booking_state_transition: the status no longer matches p_history_from. */
const BOOKING_STATE_CONFLICT_SQLSTATE = 'P0004';

async function confirmPendingBookingAfterAssignment(params: {
  booking: BookingRow;
  tableIds: string[];
  idempotencyKey: string;
  assignedBy: string | null;
  supabase: DbClient;
}): Promise<BookingRow> {
  const { booking, tableIds, idempotencyKey, assignedBy, supabase } = params;

  if (!PENDING_ASSIGNMENT_STATUSES.has(String(booking.status))) {
    return booking;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase.rpc('apply_booking_state_transition', {
    p_booking_id: booking.id,
    p_status: 'confirmed',
    p_checked_in_at: booking.checked_in_at ?? null,
    p_checked_out_at: booking.checked_out_at ?? null,
    p_updated_at: nowIso,
    p_history_from: booking.status,
    p_history_to: 'confirmed',
    p_history_changed_by: assignedBy,
    p_history_changed_at: nowIso,
    p_history_reason: 'direct_table_assignment',
    p_history_metadata: {
      source: 'direct_assignment',
      tableIds,
      idempotencyKey,
    },
  });

  if (error) {
    if (error.code === BOOKING_STATE_CONFLICT_SQLSTATE) {
      // The status compare-and-set lost: the booking changed after it was read (auto-assign
      // confirmed it, or it was cancelled). A booking that is now confirmed is exactly the
      // outcome this step wanted; anything else is a state conflict the client refreshes on.
      const current = await loadBooking(booking.id, supabase).catch(() => null);
      if (current && String(current.status) === 'confirmed') {
        return { ...booking, ...current };
      }
      throw new DirectAssignmentError(
        'This booking was updated by someone else. Refresh and try again.',
        'BOOKING_STATE_CONFLICT',
        409,
      );
    }
    // Database text (message, hint) is never carried: it would reach logs and clients.
    throw new DirectAssignmentError(
      'Tables were assigned but booking status could not be confirmed',
      'BOOKING_STATUS_TRANSITION_FAILED',
      500,
      { bookingId: booking.id, tableIds, sqlState: error.code ?? null },
    );
  }

  const transitioned = Array.isArray(data) ? data[0] : data;

  return {
    ...booking,
    status: (transitioned?.status as BookingRow['status'] | undefined) ?? 'confirmed',
    checked_in_at:
      (transitioned?.checked_in_at as string | null | undefined) ?? booking.checked_in_at ?? null,
    checked_out_at:
      (transitioned?.checked_out_at as string | null | undefined) ?? booking.checked_out_at ?? null,
    updated_at: (transitioned?.updated_at as string | undefined) ?? nowIso,
  };
}

/**
 * Builds the normalized idempotent success result from already-persisted
 * assignment rows.
 *
 * Used both for the up-front idempotency hit and as the recovery path when a
 * concurrent request with the SAME idempotency key wins the race and our commit
 * loses on the (booking_id, table_id) unique constraint. In both cases the
 * caller should observe the same already-assigned result rather than an error.
 */
async function buildIdempotentResultFromExisting(params: {
  existingRows: ExistingAssignmentRow[];
  bookingId: string;
  tableIds: string[];
  idempotencyKey: string;
  assignedBy: string | null;
  supabase: DbClient;
}): Promise<DirectAssignmentResult> {
  const { existingRows, bookingId, tableIds, idempotencyKey, assignedBy, supabase } = params;

  // Idempotency is only sound when the key maps to the SAME table set. The key is
  // a free-form client string, so the same key can arrive with a different set of
  // tables. Returning the previously-persisted rows as "success" in that case
  // emits an inconsistent body (old assignments, summary computed from the new
  // tables) AND silently drops the requested assignment. Detect the mismatch and
  // surface a 409 instead of fabricating success. (#2)
  const requestedTableSet = new Set(tableIds);
  const existingTableSet = new Set(
    existingRows.map((row) => row.table_id).filter((id): id is string => Boolean(id)),
  );
  const sameTableSet =
    requestedTableSet.size === existingTableSet.size &&
    [...requestedTableSet].every((id) => existingTableSet.has(id));
  if (!sameTableSet) {
    throw new DirectAssignmentError(
      'Idempotency key was already used for a different set of tables',
      'IDEMPOTENCY_KEY_CONFLICT',
      409,
      {
        requestedTableIds: [...requestedTableSet].sort(),
        existingTableIds: [...existingTableSet].sort(),
      },
    );
  }

  const booking = await loadBooking(bookingId, supabase);
  const transitionedBooking = await confirmPendingBookingAfterAssignment({
    booking,
    tableIds,
    idempotencyKey,
    assignedBy,
    supabase,
  });
  const tables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  const summary = summarizeSelection(tables, booking.party_size);

  return {
    success: true,
    assignments: existingRows.map((a) => ({
      id: a.id!,
      booking_id: a.booking_id!,
      table_id: a.table_id!,
      assigned_at: a.assigned_at!,
      assigned_by: a.assigned_by ?? null,
    })),
    booking: {
      id: transitionedBooking.id,
      status: transitionedBooking.status,
      party_size: transitionedBooking.party_size,
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
export async function assignTablesDirectly(
  input: DirectAssignmentInput,
): Promise<DirectAssignmentResult> {
  const { bookingId, tableIds, idempotencyKey, assignedBy = null, client } = input;

  // === STEP 1: Input Validation ===
  if (!bookingId || typeof bookingId !== 'string') {
    throw new DirectAssignmentError('Invalid booking ID', 'INVALID_INPUT', 400);
  }

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new DirectAssignmentError('At least one table must be selected', 'INVALID_INPUT', 400);
  }

  if (new Set(tableIds).size !== tableIds.length) {
    throw new DirectAssignmentError('Duplicate table IDs are not allowed', 'INVALID_INPUT', 400);
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new DirectAssignmentError('Idempotency key is required', 'INVALID_INPUT', 400);
  }

  const supabase = ensureClient(client);

  // === STEP 2: Check Idempotency - Return existing assignments if already processed ===
  const { data: existingData, error: existingError } = await supabase
    .from('booking_table_assignments')
    .select('id, booking_id, table_id, assigned_at, assigned_by')
    .eq('booking_id', bookingId)
    .eq('idempotency_key', idempotencyKey);

  if (existingError) {
    console.error('[direct-assignment] Error checking idempotency:', existingError);
    // Continue with assignment if we can't check (don't fail)
  }

  if (existingData && existingData.length > 0) {
    // Already processed - return existing result (idempotency)
    return buildIdempotentResultFromExisting({
      existingRows: existingData,
      bookingId,
      tableIds,
      idempotencyKey,
      assignedBy,
      supabase,
    });
  }

  // === STEP 3: Load Booking ===
  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants)
      ? booking.restaurants.timezone
      : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone ??
    'UTC';

  if (
    !isTableAssignmentAllowed({
      status: booking.status ?? null,
      bookingDate: booking.booking_date ?? null,
      timezone: restaurantTimezone,
    })
  ) {
    throw new DirectAssignmentError(
      'Assignments are locked for past or completed bookings',
      'ASSIGNMENT_LOCKED',
      409,
    );
  }

  // === STEP 4: Load Tables ===
  const tables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);

  if (tables.length !== tableIds.length) {
    const foundIds = tables.map((t) => t.id);
    const missingIds = tableIds.filter((id) => !foundIds.includes(id));
    throw new DirectAssignmentError(
      `Tables not found: ${missingIds.join(', ')}`,
      'TABLES_NOT_FOUND',
      404,
      { missingTableIds: missingIds },
    );
  }

  // === STEP 5: Compute Booking Window ===
  const restaurantTimezoneForPolicy = restaurantTimezone;
  const [turnBandsByOption, serviceWindows] = await Promise.all([
    getRestaurantTurnBands(booking.restaurant_id, supabase),
    getRestaurantServiceWindows(booking.restaurant_id, supabase),
  ]);
  const policy = getVenuePolicy({
    timezone: restaurantTimezoneForPolicy ?? undefined,
    turnBandsByOption,
    serviceWindows,
  });

  let window: BookingWindow;
  try {
    ({ window } = computeBookingWindowWithFallback({
      startISO: booking.start_at,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      partySize: booking.party_size,
      bookingOption: booking.booking_type ?? null,
      policy,
      restaurantId: booking.restaurant_id,
    }));
  } catch (error) {
    if (error instanceof ServiceOverrunError) {
      throw new DirectAssignmentError(error.message, 'SERVICE_OVERRUN', 422);
    }
    if (error instanceof ServiceNotFoundError) {
      throw new DirectAssignmentError(
        'Booking time is outside every configured service window',
        'OUTSIDE_SERVICE_HOURS',
        422,
      );
    }
    throw error;
  }

  // === STEP 6: Run Validation ===
  // Hard invariant: merged assignments must satisfy adjacency; do not allow bypass.
  const validation = await validateSelection({
    bookingId,
    booking,
    tables,
    window,
    restaurantTimezone: restaurantTimezoneForPolicy ?? undefined,
    turnBandsByOption,
    supabase,
  });

  if (!validation.valid) {
    const firstError = validation.checks.find((c) => !c.passed);
    throw new DirectAssignmentError(
      firstError?.message || 'Validation failed',
      firstError?.id.toUpperCase() || 'VALIDATION_FAILED',
      422,
      {
        checks: validation.checks,
        conflicts: validation.conflicts,
      },
    );
  }

  // === STEP 7: Commit through the atomic allocator path ===
  try {
    await assignTableToBooking(bookingId, tableIds, assignedBy, supabase, {
      idempotencyKey,
      requireAdjacency: true,
      booking,
    });
  } catch (error) {
    if (error instanceof AssignTablesRpcError) {
      const mapped = mapAtomicAssignmentError(error);

      // TOCTOU recovery: the idempotency pre-check (STEP 2) is a plain read with
      // no DB unique constraint, so a concurrent request with the SAME
      // idempotency key can race past it and win the (booking_id, table_id)
      // unique constraint, leaving us with a raw 409. If the same-key rows are
      // now present, treat this as already-assigned and return the same
      // idempotent result the loser would otherwise have gotten.
      if (mapped.status === 409) {
        const existingRows = await loadAssignmentsForIdempotencyKey({
          bookingId,
          idempotencyKey,
          supabase,
        });
        if (existingRows.length > 0) {
          return buildIdempotentResultFromExisting({
            existingRows,
            bookingId,
            tableIds,
            idempotencyKey,
            assignedBy,
            supabase,
          });
        }
      }

      throw mapped;
    }
    throw error;
  }

  const transitionedBooking = await confirmPendingBookingAfterAssignment({
    booking,
    tableIds,
    idempotencyKey,
    assignedBy,
    supabase,
  });

  const { data: assignedRows, error: assignmentLoadError } = await supabase
    .from('booking_table_assignments')
    .select('id, booking_id, table_id, assigned_at, assigned_by')
    .eq('booking_id', bookingId)
    .in('table_id', tableIds);

  if (assignmentLoadError) {
    throw new DirectAssignmentError(
      `Failed to load created assignments: ${assignmentLoadError.message}`,
      'ASSIGNMENT_SYNC_FAILED',
      500,
    );
  }

  const insertedAssignments = assignedRows ?? [];
  const assignedTableIds = new Set(insertedAssignments.map((assignment) => assignment.table_id));
  const missingAssignmentIds = tableIds.filter((tableId) => !assignedTableIds.has(tableId));

  if (insertedAssignments.length === 0 || missingAssignmentIds.length > 0) {
    throw new DirectAssignmentError(
      'Atomic assignment completed but assignment rows were not available',
      'ASSIGNMENT_SYNC_FAILED',
      500,
      { missingTableIds: missingAssignmentIds },
    );
  }

  // === STEP 8: Return Success ===
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
      id: transitionedBooking.id,
      status: transitionedBooking.status,
      party_size: transitionedBooking.party_size,
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
  restaurantTimezone?: string;
  turnBandsByOption?: TurnBandsByOption | null;
  supabase: DbClient;
}): Promise<ValidationResult> {
  const { bookingId, booking, tables, window, restaurantTimezone, turnBandsByOption, supabase } =
    params;
  const checks: ValidationCheck[] = [];
  const summary = summarizeSelection(tables, booking.party_size);

  const unavailableTables = tables.filter((table) => {
    const outOfService =
      typeof table.status === 'string' && table.status.toLowerCase() === 'out_of_service';
    return table.active === false || table.zoneActive === false || outOfService;
  });

  checks.push({
    id: 'inactive_table',
    passed: unavailableTables.length === 0,
    message:
      unavailableTables.length === 0
        ? 'All selected tables are active'
        : `Cannot assign to disabled or out-of-service tables: ${unavailableTables
            .map((t) => t.tableNumber)
            .join(', ')}`,
    details: {
      tableIds: unavailableTables.map((t) => t.id),
      statuses: unavailableTables.map((t) => t.status ?? null),
      zoneActive: unavailableTables.map((t) => t.zoneActive ?? null),
    },
  });

  // Check 1: Zone consistency - All tables must be in the same zone
  const zones = new Set<string | null>(tables.map((t) => t.zoneId ?? null));
  const [onlyZone] = Array.from(zones.values());
  const singleZone = zones.size <= 1;
  const mergedZoneOk = tables.length <= 1 ? true : singleZone && Boolean(onlyZone);
  checks.push({
    id: 'zone',
    passed: mergedZoneOk,
    message: mergedZoneOk
      ? summary.zoneId
        ? `All tables in zone ${summary.zoneId}`
        : 'No zone specified'
      : tables.length > 1 && !onlyZone
        ? 'Merged assignments require all tables to belong to the same (non-empty) zone.'
        : `Tables are in different zones: ${Array.from(zones).join(', ')}`,
    details: {
      zones: Array.from(zones),
      zoneId: summary.zoneId,
    },
  });

  // Check 2: Zone lock (if booking has assigned zone)
  if (booking.assigned_zone_id && summary.zoneId && booking.assigned_zone_id !== summary.zoneId) {
    checks.push({
      id: 'zone_locked',
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
    const nonMergeable = tables.filter((t) => {
      const rules = deriveTableRules({ capacity: t.capacity ?? 0, mobility: t.mobility });
      return !rules.canBeMerged;
    });
    const allMovable = nonMergeable.length === 0;
    checks.push({
      id: 'movable',
      passed: allMovable,
      message: allMovable
        ? 'All tables are movable (can be merged)'
        : `Merged assignments require movable tables. Non-movable tables: ${nonMergeable.map((t) => t.tableNumber).join(', ')}`,
      details: {
        allMovable,
        nonMovableTables: nonMergeable.map((t) => ({
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
    id: 'capacity',
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
  if (tables.length > 1) {
    const tableIds = tables.map((t) => t.id);
    const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);
    const evaluation = evaluateAdjacency(tableIds, adjacency);
    const adjacencyMode = getAllocatorAdjacencyMode();
    const adjacencyOk = isAdjacencySatisfied(evaluation, adjacencyMode);

    const failureMessage =
      adjacencyMode === 'pairwise'
        ? 'Tables must be adjacent to every other selected table'
        : adjacencyMode === 'neighbors'
          ? 'Tables must share a common neighbor/hub to be merged'
          : 'Tables must remain connected when adjacency enforcement is enabled';

    checks.push({
      id: 'adjacency',
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
    policy: getVenuePolicy({ timezone: restaurantTimezone ?? undefined, turnBandsByOption }),
    targetWindow: window,
  });

  const conflicts = extractConflictsForTables(
    busyMaps,
    tables.map((t) => t.id),
    window,
  );

  checks.push({
    id: 'conflicts',
    passed: conflicts.length === 0,
    message:
      conflicts.length === 0
        ? 'No time conflicts with other bookings'
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
    throw new DirectAssignmentError('Invalid input', 'INVALID_INPUT', 400);
  }

  if (new Set(tableIds).size !== tableIds.length) {
    throw new DirectAssignmentError('Duplicate table IDs are not allowed', 'INVALID_INPUT', 400);
  }

  const supabase = ensureClient(client);

  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants)
      ? booking.restaurants.timezone
      : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone ??
    'UTC';

  if (
    !isTableAssignmentAllowed({
      status: booking.status ?? null,
      bookingDate: booking.booking_date ?? null,
      timezone: restaurantTimezone,
    })
  ) {
    throw new DirectAssignmentError(
      'Assignments are locked for past or completed bookings',
      'ASSIGNMENT_LOCKED',
      409,
    );
  }

  const rpc = supabase.rpc as unknown as (
    fn: 'remove_booking_table_assignments_and_reopen_if_empty',
    args: {
      p_booking_id: string;
      p_table_ids: string[];
    },
  ) => Promise<{ data: number | null; error: { message: string } | null }>;
  const { data: removedCount, error } = await rpc.call(
    supabase,
    'remove_booking_table_assignments_and_reopen_if_empty',
    {
      p_booking_id: bookingId,
      p_table_ids: tableIds,
    },
  );

  if (error) {
    throw new DirectAssignmentError(
      `Failed to remove assignments: ${error.message}`,
      'DELETE_FAILED',
      500,
    );
  }

  return {
    success: true,
    removedCount: removedCount ?? 0,
  };
}

/**
 * Clean up orphaned table assignments for a booking.
 *
 * Orphaned assignments occur when a table is deleted from the inventory
 * but the assignment record still exists. This function removes those
 * stale records.
 *
 * @param bookingId - The booking to clean up
 * @param orphanedTableIds - Array of table IDs that no longer exist
 * @param client - Optional Supabase client
 */
export async function cleanupOrphanedAssignments(params: {
  bookingId: string;
  orphanedTableIds: string[];
  client?: DbClient;
}): Promise<{ success: true; removedCount: number }> {
  const { bookingId, orphanedTableIds, client } = params;

  if (!bookingId || !Array.isArray(orphanedTableIds) || orphanedTableIds.length === 0) {
    return { success: true, removedCount: 0 };
  }

  const supabase = ensureClient(client);

  const { error, count } = await supabase
    .from('booking_table_assignments')
    .delete({ count: 'exact' })
    .eq('booking_id', bookingId)
    .in('table_id', orphanedTableIds);

  if (error) {
    console.error('[direct-assignment] failed to cleanup orphaned assignments', {
      bookingId,
      orphanedTableIds,
      error,
    });
    throw new DirectAssignmentError(
      `Failed to cleanup orphaned assignments: ${error.message}`,
      'CLEANUP_FAILED',
      500,
    );
  }

  console.info('[direct-assignment] cleaned up orphaned assignments', {
    bookingId,
    orphanedTableIds,
    removedCount: count ?? 0,
  });

  return {
    success: true,
    removedCount: count ?? 0,
  };
}
