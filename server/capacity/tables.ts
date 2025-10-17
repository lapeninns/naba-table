/**
 * Capacity & Availability Engine - Table Assignment Service
 * Story 2: Stub for v2 (Manual Assignment Only in v1)
 * 
 * This service will handle:
 * - Finding suitable tables for party size
 * - Auto-assignment algorithm
 * - Table combinability logic
 * 
 * For v1: All table assignments are manual via ops dashboard
 * For v2: Implement auto-assignment here
 */

import { DateTime } from "luxon";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";
import {
  bandDuration,
  defaultVenuePolicy,
  getBufferConfig,
  getVenuePolicy,
  PolicyError,
  ServiceKey,
  ServiceNotFoundError,
  ServiceOverrunError,
  VenuePolicy,
  whichService,
  serviceWindowFor,
} from "./policy";

type DbClient = SupabaseClient<Database, "public", any>;

// =====================================================
// Types
// =====================================================

export type Table = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  section: string | null;
  seatingType: string;
  status: string;
  position: Record<string, any> | null;
};

export type TableMatchParams = {
  partySize: number;
  seatingPreference?: string;
  section?: string;
};

export type TableAssignment = {
  tableId: string;
  tableNumber: string;
  capacity: number | null;
  section: string | null;
};

const INACTIVE_BOOKING_STATUSES = new Set<Tables<"bookings">["status"]>(["cancelled", "no_show"]);
const ASSIGNABLE_BOOKING_STATUSES = new Set<Tables<"bookings">["status"]>([
  "pending",
  "pending_allocation",
  "confirmed",
]);

type IntervalMs = {
  start: number;
  end: number;
};

type BookingWindow = {
  service: ServiceKey;
  durationMinutes: number;
  dining: {
    start: DateTime;
    end: DateTime;
  };
  block: {
    start: DateTime;
    end: DateTime;
  };
};

type TableScheduleEntry = {
  bookingId: string;
  start: number; // Block start (ms)
  end: number; // Block end (ms) — stored as half-open interval [start, end)
  status: Tables<"bookings">["status"];
};

type ComputeBookingWindowArgs = {
  startISO: string | null | undefined;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  policy: VenuePolicy;
  serviceHint?: ServiceKey | null;
};

function windowsOverlap(a: IntervalMs, b: IntervalMs): boolean {
  return a.start < b.end && b.start < a.end;
}

function toInterval(range: { start: DateTime; end: DateTime }): IntervalMs {
  return {
    start: range.start.toMillis(),
    end: range.end.toMillis(),
  };
}

function resolveStartDateTime(args: {
  startISO: string | null | undefined;
  bookingDate?: string | null;
  startTime?: string | null;
  policy: VenuePolicy;
}): DateTime | null {
  const { startISO, bookingDate, startTime, policy } = args;

  if (startISO) {
    const start = DateTime.fromISO(startISO, { setZone: true });
    if (start.isValid) {
      return start.setZone(policy.timezone, { keepLocalTime: false });
    }
  }

  if (bookingDate && startTime) {
    const combined = DateTime.fromISO(`${bookingDate}T${startTime}`, {
      zone: policy.timezone,
    });
    if (combined.isValid) {
      return combined;
    }
  }

  return null;
}

function computeBookingWindow(args: ComputeBookingWindowArgs): BookingWindow | null {
  const { startISO, bookingDate, startTime, partySize, policy, serviceHint } = args;
  if (!Number.isFinite(partySize) || partySize <= 0) {
    return null;
  }

  const start = resolveStartDateTime({ startISO, bookingDate, startTime, policy });
  if (!start) {
    return null;
  }

  const service =
    serviceHint ?? whichService(start, policy);

  if (!service) {
    throw new ServiceNotFoundError(start);
  }

  const window = serviceWindowFor(service, start, policy);
  const duration = bandDuration(service, partySize, policy);

  const diningEnd = start.plus({ minutes: duration });
  if (diningEnd > window.end) {
    throw new ServiceOverrunError(service, diningEnd, window.end);
  }

  const buffer = getBufferConfig(service, policy);
  const blockStart = buffer.pre > 0 ? start.minus({ minutes: buffer.pre }) : start;
  const blockEnd = buffer.post > 0 ? diningEnd.plus({ minutes: buffer.post }) : diningEnd;

  if (blockEnd > window.end) {
    throw new ServiceOverrunError(
      service,
      blockEnd,
      window.end,
      `Reservation plus buffer exceeds ${service} service end (${window.end.toFormat("HH:mm")}).`,
    );
  }

  return {
    service,
    durationMinutes: duration,
    dining: { start, end: diningEnd },
    block: { start: blockStart, end: blockEnd },
  };
}

function tableWindowIsFree(
  tableId: string,
  targetInterval: IntervalMs,
  schedule: Map<string, TableScheduleEntry[]>,
  bookingId?: string,
): boolean {
  const entries = schedule.get(tableId);
  if (!entries || entries.length === 0) {
    return true;
  }

  return entries.every((entry) => {
    if (entry.bookingId === bookingId) {
      return true;
    }

    if (INACTIVE_BOOKING_STATUSES.has(entry.status)) {
      return true;
    }

    return !windowsOverlap(targetInterval, { start: entry.start, end: entry.end });
  });
}

function filterAvailableTables(
  tables: Table[],
  partySize: number,
  window: BookingWindow,
  schedule: Map<string, TableScheduleEntry[]>,
  preferences: TableMatchParams | undefined,
  bookingId?: string,
): Table[] {
  const targetInterval = toInterval(window.block);

  return tables.filter((table) => {
    if (!table || !Number.isFinite(table.capacity) || table.capacity <= 0) {
      return false;
    }

    if (table.status === "out_of_service" || table.status === "occupied") {
      return false;
    }

    if (
      preferences?.seatingPreference &&
      preferences.seatingPreference !== "any" &&
      table.seatingType &&
      table.seatingType !== preferences.seatingPreference
    ) {
      return false;
    }

    if (preferences?.section && table.section && table.section !== preferences.section) {
      return false;
    }

    if (table.minPartySize && partySize < table.minPartySize) {
      return false;
    }

    return tableWindowIsFree(table.id, targetInterval, schedule, bookingId);
  });
}

type CombinationScore = {
  tables: number;
  waste: number;
  maxCapacity: number;
};

function chooseTableCombination(tables: Table[], partySize: number): Table[] | null {
  if (tables.length === 0) {
    return null;
  }

  const ordered = [...tables].sort((a, b) => a.capacity - b.capacity);

  let best: Table[] | null = null;
  let bestScore: CombinationScore | null = null;

  const consider = (combo: Table[]) => {
    const totalCapacity = combo.reduce((sum, table) => sum + table.capacity, 0);
    if (totalCapacity < partySize) {
      return;
    }

    if (combo.length === 1) {
      const [table] = combo;
      if (table.maxPartySize !== null && partySize > table.maxPartySize) {
        return;
      }
    }

    const score: CombinationScore = {
      tables: combo.length,
      waste: totalCapacity - partySize,
      maxCapacity: combo.reduce((max, table) => Math.max(max, table.capacity), 0),
    };

    if (!bestScore) {
      best = combo.slice();
      bestScore = score;
      return;
    }

    const isBetter =
      score.tables < bestScore.tables ||
      (score.tables === bestScore.tables && score.waste < bestScore.waste) ||
      (score.tables === bestScore.tables &&
        score.waste === bestScore.waste &&
        score.maxCapacity < bestScore.maxCapacity);

    if (isBetter) {
      best = combo.slice();
      bestScore = score;
    }
  };

  // Single table
  ordered.forEach((table) => {
    consider([table]);
  });

  // Pairs
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      consider([ordered[i], ordered[j]]);
    }
  }

  // Triples
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      for (let k = j + 1; k < ordered.length; k += 1) {
        consider([ordered[i], ordered[j], ordered[k]]);
      }
    }
  }

  if (best) {
    return best;
  }

  // Greedy fallback (allow >3 tables if needed)
  const greedy: Table[] = [];
  let accumulated = 0;
  const descending = [...ordered].sort((a, b) => b.capacity - a.capacity);
  for (const table of descending) {
    greedy.push(table);
    accumulated += table.capacity;
    if (accumulated >= partySize) {
      return greedy;
    }
  }

  return null;
}

type BookingRecordForAssignment = {
  id: string;
  party_size: number | null;
  status: Tables<"bookings">["status"];
  start_time: string | null;
  end_time: string | null;
  seating_preference: string | null;
  start_at: string | null;
  booking_date: string | null;
};

async function assignTablesForBooking(params: {
  booking: BookingRecordForAssignment;
  tables: Table[];
  schedule: Map<string, TableScheduleEntry[]>;
  assignedBy?: string | null;
  client: DbClient;
  preferences?: TableMatchParams;
  policy: VenuePolicy;
}): Promise<{ tableIds: string[] } | { reason: string }> {
  const { booking, tables, schedule, assignedBy, client, preferences, policy } = params;
  const partySize = booking.party_size ?? 0;

  if (!Number.isFinite(partySize) || partySize <= 0) {
    return { reason: "Party size is not set for this booking" };
  }

  let window: BookingWindow | null;
  try {
    window = computeBookingWindow({
      startISO: booking.start_at,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      partySize,
      policy,
    });
  } catch (error) {
    if (error instanceof PolicyError) {
      return { reason: error.message };
    }
    throw error;
  }

  if (!window) {
    return { reason: "Booking time is incomplete; cannot determine seating window" };
  }

  const targetInterval = toInterval(window.block);

  let effectivePreferences: TableMatchParams | undefined = preferences ? { ...preferences } : undefined;

  if (booking.seating_preference && booking.seating_preference !== "any") {
    if (!effectivePreferences) {
      effectivePreferences = { partySize, seatingPreference: booking.seating_preference };
    } else {
      effectivePreferences.seatingPreference = booking.seating_preference;
    }
  }

  const availableTables = filterAvailableTables(
    tables,
    partySize,
    window,
    schedule,
    effectivePreferences,
    booking.id,
  );

  if (availableTables.length === 0) {
    return { reason: "No suitable tables are available for the booking window" };
  }

  const combination = chooseTableCombination(availableTables, partySize);
  if (!combination || combination.length === 0) {
    return { reason: "Unable to find a table combination that fits the party size" };
  }

  const assignedTableIds: string[] = [];
  const scheduleUpdates: { tableId: string; entry: TableScheduleEntry }[] = [];

  try {
    for (const table of combination) {
      await assignTableToBooking(booking.id, table.id, assignedBy ?? undefined, client);
      assignedTableIds.push(table.id);

      scheduleUpdates.push({
        tableId: table.id,
        entry: {
          bookingId: booking.id,
          start: targetInterval.start,
          end: targetInterval.end,
          status: booking.status,
        },
      });
    }

    for (const update of scheduleUpdates) {
      const existing = schedule.get(update.tableId) ?? [];
      existing.push(update.entry);
      schedule.set(update.tableId, existing);
    }

    return { tableIds: assignedTableIds };
  } catch (error) {
    for (const tableId of assignedTableIds) {
      try {
        await unassignTableFromBooking(booking.id, tableId, client);
      } catch (rollbackError) {
        console.error("[capacity][autoAssign] failed to rollback table assignment", {
          bookingId: booking.id,
          tableId,
          error: rollbackError,
        });
      }
    }

    return {
      reason: error instanceof Error ? error.message : "Failed to assign tables",
    };
  }
}

type BookingRowWithAssignments = BookingRecordForAssignment & {
  booking_table_assignments: { table_id: string | null }[] | null;
};

type AssignmentContext = {
  tables: Table[];
  bookings: BookingRowWithAssignments[];
  schedule: Map<string, TableScheduleEntry[]>;
  policy: VenuePolicy;
};

async function loadAssignmentContext(params: {
  restaurantId: string;
  date: string;
  client: DbClient;
}): Promise<AssignmentContext> {
  const { restaurantId, date, client } = params;

  const [tablesResult, bookingsResult, restaurantResult] = await Promise.all([
    client
      .from("table_inventory")
      .select(
        `
          id,
          table_number,
          capacity,
          min_party_size,
          max_party_size,
          section,
          seating_type,
          status,
          position
        `,
      )
      .eq("restaurant_id", restaurantId)
      .order("capacity", { ascending: true }),
    client
      .from("bookings")
      .select(
        `
          id,
          party_size,
          status,
          start_time,
          end_time,
          start_at,
          booking_date,
          seating_preference,
          booking_table_assignments (
            table_id
          )
        `,
      )
      .eq("restaurant_id", restaurantId)
      .eq("booking_date", date)
      .order("start_time", { ascending: true }),
    client
      .from("restaurants")
      .select("timezone")
      .eq("id", restaurantId)
      .maybeSingle(),
  ]);

  if (tablesResult.error) {
    throw new Error(`Failed to load table inventory: ${tablesResult.error.message}`);
  }

  if (bookingsResult.error) {
    throw new Error(`Failed to load bookings for auto assignment: ${bookingsResult.error.message}`);
  }

  if (restaurantResult.error) {
    throw new Error(`Failed to load restaurant timezone: ${restaurantResult.error.message}`);
  }

  const timezone = restaurantResult.data?.timezone ?? defaultVenuePolicy.timezone;
  const policy = getVenuePolicy({ timezone });

  const tables: Table[] = (tablesResult.data ?? []).map((row: any) => ({
    id: row.id,
    tableNumber: row.table_number,
    capacity: row.capacity,
    minPartySize: row.min_party_size,
    maxPartySize: row.max_party_size,
    section: row.section,
    seatingType: row.seating_type,
    status: row.status,
    position: row.position ?? null,
  }));

  const bookings: BookingRowWithAssignments[] = (bookingsResult.data ?? []) as BookingRowWithAssignments[];
  const schedule = new Map<string, TableScheduleEntry[]>();

  for (const booking of bookings) {
    const assignments = Array.isArray(booking.booking_table_assignments)
      ? booking.booking_table_assignments
      : [];

    if (assignments.length === 0) {
      continue;
    }

    if (INACTIVE_BOOKING_STATUSES.has(booking.status)) {
      continue;
    }

    let window: BookingWindow | null;
    try {
      window = computeBookingWindow({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize: booking.party_size ?? 0,
        policy,
      });
    } catch (error) {
      if (error instanceof PolicyError) {
        // Skip invalid bookings from schedule; operations team should resolve.
        continue;
      }
      throw error;
    }

    if (!window) {
      continue;
    }

    const blockInterval = toInterval(window.block);

    for (const assignment of assignments) {
      if (!assignment?.table_id) {
        continue;
      }

      const existing = schedule.get(assignment.table_id) ?? [];
      existing.push({
        bookingId: booking.id,
        start: blockInterval.start,
        end: blockInterval.end,
        status: booking.status,
      });
      schedule.set(assignment.table_id, existing);
    }
  }

  return { tables, bookings, schedule, policy };
}

type AutoAssignInternalParams = {
  restaurantId: string;
  date: string;
  client: DbClient;
  assignedBy?: string | null;
  targetBookingIds?: Set<string>;
  preferenceOverrides?: Map<string, TableMatchParams>;
};

export type AutoAssignResult = {
  assigned: { bookingId: string; tableIds: string[] }[];
  skipped: { bookingId: string; reason: string }[];
};

async function autoAssignTablesInternal(params: AutoAssignInternalParams): Promise<AutoAssignResult> {
  const { restaurantId, date, client, assignedBy, targetBookingIds, preferenceOverrides } = params;

  const { tables, bookings, schedule, policy } = await loadAssignmentContext({ restaurantId, date, client });

  if (tables.length === 0) {
    return {
      assigned: [],
      skipped: bookings
        .filter((booking) => !targetBookingIds || targetBookingIds.has(booking.id))
        .map((booking) => ({ bookingId: booking.id, reason: "No tables configured for restaurant" })),
    };
  }

  const bookingsToProcess = bookings
    .filter((booking) => {
      if (targetBookingIds && !targetBookingIds.has(booking.id)) {
        return false;
      }

      if (!ASSIGNABLE_BOOKING_STATUSES.has(booking.status)) {
        return false;
      }

      const assignments = Array.isArray(booking.booking_table_assignments)
        ? booking.booking_table_assignments
        : [];

      return assignments.length === 0;
    })
    .sort((a, b) => {
      const sizeA = a.party_size ?? 0;
      const sizeB = b.party_size ?? 0;
      if (sizeA !== sizeB) {
        return sizeB - sizeA; // larger parties first
      }

      const startA =
        resolveStartDateTime({
          startISO: a.start_at,
          bookingDate: a.booking_date,
          startTime: a.start_time,
          policy,
        })?.toMillis() ?? 0;
      const startB =
        resolveStartDateTime({
          startISO: b.start_at,
          bookingDate: b.booking_date,
          startTime: b.start_time,
          policy,
        })?.toMillis() ?? 0;
      return startA - startB;
    });

  const results: AutoAssignResult = {
    assigned: [],
    skipped: [],
  };

  for (const booking of bookingsToProcess) {
    const override = preferenceOverrides?.get(booking.id);
    const assignment = await assignTablesForBooking({
      booking,
      tables,
      schedule,
      assignedBy,
      client,
      preferences: override,
      policy,
    });

    if ("tableIds" in assignment && assignment.tableIds.length > 0) {
      results.assigned.push({ bookingId: booking.id, tableIds: assignment.tableIds });
    } else {
      const reason = "reason" in assignment ? assignment.reason : "Unable to assign tables";
      results.skipped.push({
        bookingId: booking.id,
        reason,
      });
    }
  }

  return results;
}

// =====================================================
// Table Finding Functions (v2)
// =====================================================

/**
 * Find suitable tables for a party size
 * 
 * v1: Returns empty array (manual assignment only)
 * v2: Will implement smart matching algorithm
 * 
 * Algorithm (v2):
 * 1. Exact match: table.capacity === partySize
 * 2. Next size up: table.capacity > partySize (smallest that fits)
 * 3. Combinable tables: 2+ tables that sum to partySize
 * 
 * @param restaurantId - Restaurant ID
 * @param params - Party size and preferences
 * @param client - Optional Supabase client
 * @returns Array of suitable tables
 */
export async function findSuitableTables(
  restaurantId: string,
  params: TableMatchParams,
  client?: DbClient
): Promise<Table[]> {
  // v1: Not implemented, return empty array
  // Ops staff will assign tables manually
  
  console.warn(
    "[v1] findSuitableTables is not implemented. Use manual table assignment in ops dashboard."
  );
  
  return [];
  
  // v2 Implementation Plan:
  // const supabase = client ?? getServiceSupabaseClient();
  // const { partySize, seatingPreference, section } = params;
  //
  // // Query available tables
  // let query = supabase
  //   .from("table_inventory")
  //   .select("*")
  //   .eq("restaurant_id", restaurantId)
  //   .eq("status", "available")
  //   .gte("capacity", partySize)
  //   .order("capacity", { ascending: true });
  //
  // if (seatingPreference && seatingPreference !== "any") {
  //   query = query.eq("seating_type", seatingPreference);
  // }
  //
  // if (section) {
  //   query = query.eq("section", section);
  // }
  //
  // const { data, error } = await query.limit(10);
  //
  // if (error) {
  //   throw new Error(`Failed to find tables: ${error.message}`);
  // }
  //
  // return data ?? [];
}

/**
 * Assign a table to a booking
 * 
 * v1: Throws error (use RPC function assign_table_to_booking directly)
 * v2: Will wrap RPC and add business logic
 * 
 * @param bookingId - Booking ID
 * @param tableId - Table ID
 * @param assignedBy - User ID of assigner
 * @param client - Optional Supabase client
 * @returns Assignment ID
 */
export async function assignTableToBooking(
  bookingId: string,
  tableId: string,
  assignedBy?: string,
  client?: DbClient
): Promise<string> {
  const supabase = client ?? getServiceSupabaseClient();

  // Call database RPC function
  const { data, error } = await supabase.rpc("assign_table_to_booking", {
    p_booking_id: bookingId,
    p_table_id: tableId,
    p_assigned_by: assignedBy ?? null,
    p_notes: null,
  });

  if (error) {
    throw new Error(`Failed to assign table: ${error.message}`);
  }

  return data as string;
}

/**
 * Unassign a table from a booking
 * 
 * v1: Calls RPC function
 * v2: Will add business logic
 * 
 * @param bookingId - Booking ID
 * @param tableId - Table ID
 * @param client - Optional Supabase client
 * @returns Success boolean
 */
export async function unassignTableFromBooking(
  bookingId: string,
  tableId: string,
  client?: DbClient
): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();

  // Call database RPC function
  const { data, error } = await supabase.rpc("unassign_table_from_booking", {
    p_booking_id: bookingId,
    p_table_id: tableId,
  });

  if (error) {
    throw new Error(`Failed to unassign table: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Get table assignments for a booking
 * 
 * @param bookingId - Booking ID
 * @param client - Optional Supabase client
 * @returns Array of table assignments
 */
export async function getBookingTableAssignments(
  bookingId: string,
  client?: DbClient
): Promise<TableAssignment[]> {
  const supabase = client ?? getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select(`
      table_id,
      table_inventory (
        table_number,
        capacity,
        section
      )
    `)
    .eq("booking_id", bookingId);

  if (error) {
    throw new Error(`Failed to get table assignments: ${error.message}`);
  }

  return (data ?? []).map((assignment: any) => ({
    tableId: assignment.table_id,
    tableNumber: assignment.table_inventory?.table_number ?? "Unknown",
    capacity: assignment.table_inventory?.capacity ?? null,
    section: assignment.table_inventory?.section ?? null,
  }));
}

// =====================================================
// Auto-Assignment Algorithm
// =====================================================

export type AutoAssignTablesOptions = {
  restaurantId: string;
  date: string;
  assignedBy?: string | null;
  client?: DbClient;
};

/**
 * Auto-assign tables for a single booking.
 *
 * @param bookingId - Booking identifier
 * @param _partySize - (legacy) desired party size, fetched from booking record instead
 * @param preferences - Optional preference overrides (e.g., seating type)
 * @param options - Restaurant/date context for the assignment run
 */
export async function autoAssignTables(
  bookingId: string,
  _partySize: number,
  preferences?: TableMatchParams,
  options?: AutoAssignTablesOptions,
): Promise<string[]> {
  if (!options) {
    throw new Error("autoAssignTables requires restaurantId and date options");
  }

  const supabase = options.client ?? getServiceSupabaseClient();
  const preferenceOverrides = new Map<string, TableMatchParams>();

  if (preferences) {
    preferenceOverrides.set(bookingId, preferences);
  }

  const result = await autoAssignTablesInternal({
    restaurantId: options.restaurantId,
    date: options.date,
    assignedBy: options.assignedBy,
    client: supabase,
    targetBookingIds: new Set([bookingId]),
    preferenceOverrides,
  });

  const success = result.assigned.find((entry) => entry.bookingId === bookingId);
  if (success) {
    return success.tableIds;
  }

  const failure = result.skipped.find((entry) => entry.bookingId === bookingId);
  if (failure) {
    throw new Error(failure.reason || "Unable to assign tables to booking");
  }

  return [];
}

export type AutoAssignTablesForDateParams = {
  restaurantId: string;
  date: string;
  assignedBy?: string | null;
  client?: DbClient;
};

export async function autoAssignTablesForDate(params: AutoAssignTablesForDateParams): Promise<AutoAssignResult> {
  const { restaurantId, date, assignedBy, client } = params;
  const supabase = client ?? getServiceSupabaseClient();

  return autoAssignTablesInternal({
    restaurantId,
    date,
    assignedBy,
    client: supabase,
  });
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Check if a table is available at a specific time
 * 
 * v1: Basic implementation
 * v2: Add slot-level checking
 */
export async function isTableAvailable(
  tableId: string,
  date: string,
  startTime: string,
  endTime: string,
  client?: DbClient
): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();

  // Check if table has any conflicting assignments
  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select(`
      id,
      bookings!inner (
        booking_date,
        start_time,
        end_time,
        status
      )
    `)
    .eq("table_id", tableId);

  if (error) {
    throw new Error(`Failed to check table availability: ${error.message}`);
  }

  // Check for time overlaps with active bookings
  const hasConflict = (data ?? []).some((assignment: any) => {
    const booking = assignment.bookings;
    
    // Skip cancelled/no-show bookings
    if (["cancelled", "no_show"].includes(booking.status)) {
      return false;
    }

    // Same date?
    if (booking.booking_date !== date) {
      return false;
    }

    // Time overlap?
    // Booking: [booking.start_time, booking.end_time)
    // Requested: [startTime, endTime)
    // Overlap if: booking.start_time < endTime AND startTime < booking.end_time
    return booking.start_time < endTime && startTime < booking.end_time;
  });

  return !hasConflict;
}

export const __internal = {
  computeBookingWindow,
  windowsOverlap,
  resolveStartDateTime,
};
