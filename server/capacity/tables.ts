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
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { env } from "@/lib/env";
import { getServiceSupabaseClient } from "@/server/supabase";
import { isAssignAtomicEnabled, isRpcAssignAtomicEnabled } from "@/server/feature-flags";
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
  category: string;
  seatingType: string;
  mobility: string;
  zoneId: string;
  status: string;
  active: boolean;
  mergeEligible: boolean;
  position: Record<string, any> | null;
};

export type TableMatchParams = {
  partySize: number;
  seatingPreference?: string;
  section?: string;
};

export type TableAssignmentMember = {
  tableId: string;
  tableNumber: string;
  capacity: number | null;
  section: string | null;
};

export type TableAssignmentGroup = {
  groupId: string | null;
  capacitySum: number | null;
  members: TableAssignmentMember[];
};

type TableInventoryRecord = {
  table_number?: string | null;
  capacity?: number | string | null;
  section?: string | null;
};
type MergeGroupRecord = {
  capacity?: number | string | null;
};

function normalizeRelationshipRecord<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function getNumericCapacity(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const numericCapacity = Number(value);
  return Number.isFinite(numericCapacity) ? numericCapacity : null;
}

function getMergeGroupCapacity(
  mergeGroup: MergeGroupRecord | MergeGroupRecord[] | null | undefined,
): number | null {
  const record = normalizeRelationshipRecord(mergeGroup);
  return getNumericCapacity(record?.capacity);
}

const INACTIVE_BOOKING_STATUSES = new Set<Tables<"bookings">["status"]>(["cancelled", "no_show"]);
const ASSIGNABLE_BOOKING_STATUSES = new Set<Tables<"bookings">["status"]>([
  "pending",
  "pending_allocation",
  "confirmed",
]);

class AtomicAssignmentError extends Error {
  code?: string;
  details: string | null;
  hint: string | null;

  constructor(
    message: string,
    options: { code?: string; details?: string | null; hint?: string | null; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AtomicAssignmentError";
    this.code = options.code;
    this.details = options.details ?? null;
    this.hint = options.hint ?? null;
    if (options.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }

  static fromPostgrest(error: PostgrestError): AtomicAssignmentError {
    return new AtomicAssignmentError(error.message ?? "assign_tables_atomic failed", {
      code: error.code,
      details: error.details ?? null,
      hint: error.hint ?? null,
      cause: error,
    });
  }
}

type IntervalMs = {
  start: number;
  end: number;
};

type BookingRowForAtomic = {
  id: string;
  restaurant_id: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  restaurants?: {
    timezone: string | null;
  } | null;
};

type BookingRowForAtomicSupabase = Pick<
  Tables<"bookings">,
  "id" | "restaurant_id" | "booking_date" | "start_time" | "end_time" | "start_at" | "end_at"
> & {
  restaurants?: { timezone: string | null }[] | { timezone: string | null } | null;
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
  mergeGroupId?: string;
  mergeType?: "single" | "merge_2_4" | "merge_4_4";
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

function composeAtomicAssignmentIdempotencyKey(params: {
  bookingId: string;
  window: { start: string; end: string };
  tableIds: string[];
}): string {
  const bookingSegment = params.bookingId.trim().toLowerCase();
  const normalizedTables = [...params.tableIds]
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id.length > 0)
    .sort((a, b) => a.localeCompare(b));

  if (normalizedTables.length === 0) {
    throw new Error("Idempotency key requires at least one table id");
  }

  const windowStart = params.window.start;
  const windowEnd = params.window.end;
  if (!windowStart || !windowEnd) {
    throw new Error("Idempotency key requires booking window boundaries");
  }

  return [bookingSegment, windowStart, windowEnd, normalizedTables.join("+")].join(":");
}

function serializeBookingBlockWindow(window: BookingWindow): { range: string; start: string; end: string } {
  const blockStartUtc = window.block.start.setZone("UTC", { keepLocalTime: false });
  const blockEndUtc = window.block.end.setZone("UTC", { keepLocalTime: false });

  if (!blockStartUtc.isValid || !blockEndUtc.isValid || blockEndUtc <= blockStartUtc) {
    throw new Error("Booking block window is invalid; cannot build atomic assignment range");
  }

  const startIso = blockStartUtc.toISO({ suppressMilliseconds: true });
  const endIso = blockEndUtc.toISO({ suppressMilliseconds: true });

  if (!startIso || !endIso) {
    throw new Error("Unable to serialise booking block window");
  }

  return {
    range: `[${startIso},${endIso})`,
    start: startIso,
    end: endIso,
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

function parseIsoDateTime(value: string | null | undefined): DateTime | null {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  return parsed.isValid ? parsed : null;
}

function buildAssignmentWindowRange(booking: BookingRowForAtomic): { range: string; start: string; end: string } {
  const startFromIso = parseIsoDateTime(booking.start_at);
  const endFromIso = parseIsoDateTime(booking.end_at);

  if (startFromIso && endFromIso && endFromIso > startFromIso) {
    const startIso = startFromIso.toUTC().toISO({ suppressMilliseconds: true });
    const endIso = endFromIso.toUTC().toISO({ suppressMilliseconds: true });
    if (!startIso || !endIso) {
      throw new Error("Unable to serialize booking window timestamps");
    }
    return { range: `[${startIso},${endIso})`, start: startIso, end: endIso };
  }

  const restaurantData = Array.isArray(booking.restaurants) 
    ? booking.restaurants[0] 
    : booking.restaurants;
  const timezone = restaurantData?.timezone ?? "UTC";

  const baseDate =
    booking.booking_date ??
    (startFromIso ? startFromIso.setZone(timezone, { keepLocalTime: true }).toISODate() : null);
  const startTime =
    booking.start_time ??
    (startFromIso ? startFromIso.setZone(timezone, { keepLocalTime: true }).toFormat("HH:mm") : null);

  if (!baseDate || !startTime) {
    throw new Error("Booking is missing scheduling information (date/time)");
  }

  let start = DateTime.fromISO(`${baseDate}T${startTime}`, { zone: timezone, setZone: true });
  if (!start.isValid && startFromIso) {
    start = startFromIso;
  }

  if (!start.isValid) {
    throw new Error("Unable to determine booking start time");
  }

  let endCandidate: DateTime | null = null;
  if (booking.end_time) {
    const derived = DateTime.fromISO(`${baseDate}T${booking.end_time}`, { zone: timezone, setZone: true });
    endCandidate = derived.isValid ? derived : null;
  }

  if ((!endCandidate || !endCandidate.isValid) && endFromIso) {
    endCandidate = endFromIso;
  }

  if (!endCandidate || !endCandidate.isValid || endCandidate <= start) {
    const defaultDurationMinutes = env.reserve.defaultDurationMinutes ?? 90;
    endCandidate = start.plus({ minutes: defaultDurationMinutes });
  }

  const startUtc = start.setZone("UTC", { keepLocalTime: false });
  const endUtc = endCandidate.setZone("UTC", { keepLocalTime: false });

  if (!startUtc.isValid || !endUtc.isValid || endUtc <= startUtc) {
    throw new Error("Resolved booking window is invalid");
  }

  const startIso = startUtc.toISO({ suppressMilliseconds: true });
  const endIso = endUtc.toISO({ suppressMilliseconds: true });

  if (!startIso || !endIso) {
    throw new Error("Failed to serialize booking assignment window");
  }

  return { range: `[${startIso},${endIso})`, start: startIso, end: endIso };
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

    if (!table.active) {
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

type TablePlan = {
  tables: Table[];
  mergeType: "single" | "merge_2_4" | "merge_4_4";
  slack: number;
};

type TablePlanResult = {
  plans: TablePlan[];
  fallbackReason?: string;
};

function generateTablePlans(tables: Table[], partySize: number, adjacency: Map<string, Set<string>>): TablePlanResult {
  if (tables.length === 0) {
    return { plans: [], fallbackReason: "No tables available for the requested booking window" };
  }

  const byCapacityAsc = [...tables].sort((a, b) => {
    if ((a.capacity ?? 0) === (b.capacity ?? 0)) {
      return (a.tableNumber ?? "").localeCompare(b.tableNumber ?? "");
    }
    return (a.capacity ?? 0) - (b.capacity ?? 0);
  });

  const plans: TablePlan[] = [];
  const seen = new Set<string>();

  const registerPlan = (plan: TablePlan) => {
    const key = [...plan.tables].map((table) => table.id).sort((a, b) => a.localeCompare(b)).join("|");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    plans.push(plan);
  };

  const eligibleSingles = byCapacityAsc.filter((table) => {
    if (!Number.isFinite(table.capacity) || (table.capacity ?? 0) <= 0) {
      return false;
    }
    if ((table.capacity ?? 0) < partySize) {
      return false;
    }
    if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
      return false;
    }
    return true;
  });

  for (const table of eligibleSingles) {
    registerPlan({
      tables: [table],
      mergeType: "single",
      slack: (table.capacity ?? 0) - partySize,
    });
  }

  let mergeFallbackReason: string | undefined;

  if (partySize >= 5 && partySize <= 6) {
    const twoTops = byCapacityAsc.filter((table) => table.capacity === 2 && table.mergeEligible);
    const fourTops = byCapacityAsc.filter((table) => table.capacity === 4 && table.mergeEligible);
    let hasMergeCandidate = false;

    for (const twoTop of twoTops) {
      for (const fourTop of fourTops) {
        if (twoTop.zoneId !== fourTop.zoneId) {
          continue;
        }
        const adjacentToTwo = adjacency.get(twoTop.id);
        if (!adjacentToTwo || !adjacentToTwo.has(fourTop.id)) {
          continue;
        }
        hasMergeCandidate = true;
        registerPlan({
          tables: [twoTop, fourTop],
          mergeType: "merge_2_4",
          slack: (twoTop.capacity ?? 0) + (fourTop.capacity ?? 0) - partySize,
        });
      }
    }

    if (!hasMergeCandidate) {
      mergeFallbackReason = "Merge (2+4) requires adjacent, merge-eligible tables in the same zone";
    }
  } else if (partySize >= 7 && partySize <= 8) {
    const fourTops = byCapacityAsc.filter((table) => table.capacity === 4 && table.mergeEligible);
    let hasMergeCandidate = false;

    for (let i = 0; i < fourTops.length; i += 1) {
      for (let j = i + 1; j < fourTops.length; j += 1) {
        const a = fourTops[i]!;
        const b = fourTops[j]!;
        if (a.zoneId !== b.zoneId) {
          continue;
        }
        const adjacentToA = adjacency.get(a.id);
        if (!adjacentToA || !adjacentToA.has(b.id)) {
          continue;
        }
        hasMergeCandidate = true;
        registerPlan({
          tables: [a, b],
          mergeType: "merge_4_4",
          slack: (a.capacity ?? 0) + (b.capacity ?? 0) - partySize,
        });
      }
    }

    if (!hasMergeCandidate) {
      mergeFallbackReason = "Merge (4+4) requires adjacent, merge-eligible 4-tops in the same zone";
    }
  } else if (eligibleSingles.length === 0) {
    mergeFallbackReason = "No merge strategy supports the requested party size";
  }

  plans.sort((a, b) => {
    if (a.mergeType === "single" && b.mergeType !== "single") {
      return -1;
    }
    if (b.mergeType === "single" && a.mergeType !== "single") {
      return 1;
    }
    if (a.slack !== b.slack) {
      return a.slack - b.slack;
    }
    const capacityA = a.tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
    const capacityB = b.tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
    if (capacityA !== capacityB) {
      return capacityA - capacityB;
    }
    const nameA = a.tables.map((table) => table.tableNumber ?? "").sort().join("+");
    const nameB = b.tables.map((table) => table.tableNumber ?? "").sort().join("+");
    return nameA.localeCompare(nameB);
  });

  return {
    plans,
    fallbackReason: plans.length === 0 ? mergeFallbackReason : undefined,
  };
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
  adjacency: Map<string, Set<string>>;
}): Promise<{ tableIds: string[] } | { reason: string }> {
  const { booking, tables, schedule, assignedBy, client, preferences, policy, adjacency } = params;
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

  const { plans: candidatePlans, fallbackReason } = generateTablePlans(availableTables, partySize, adjacency);
  if (candidatePlans.length === 0) {
    return { reason: fallbackReason ?? "Unable to locate a compatible table combination" };
  }

  const serializedWindow = serializeBookingBlockWindow(window);
  let overlapError: AtomicAssignmentError | null = null;

  for (const plan of candidatePlans) {
    const tableIds = plan.tables.map((table) => table.id);
    let idempotencyKey: string;
    try {
      idempotencyKey = composeAtomicAssignmentIdempotencyKey({
        bookingId: booking.id,
        window: { start: serializedWindow.start, end: serializedWindow.end },
        tableIds,
      });
    } catch (idKeyError) {
      console.error("[capacity][autoAssign] failed to compose idempotency key", {
        bookingId: booking.id,
        tableIds,
        error: idKeyError,
      });
      return { reason: "Failed to build idempotency key for table assignment" };
    }

    try {
      const assignments = await invokeAssignTablesAtomic({
        bookingId: booking.id,
        tableIds,
        assignedBy: assignedBy ?? null,
        idempotencyKey,
        client,
        window: serializedWindow,
      });

      if (assignments.length === 0) {
        throw new Error("assign_tables_atomic returned no assignments");
      }

      const assignmentsByTable = new Map(assignments.map((entry) => [entry.tableId, entry]));
      const mergedGroupId = assignments.find((entry) => entry.mergeGroupId)?.mergeGroupId ?? null;

      for (const table of plan.tables) {
        const rpcRow = assignmentsByTable.get(table.id);
        const updateEntry: TableScheduleEntry = {
          bookingId: booking.id,
          start: targetInterval.start,
          end: targetInterval.end,
          status: booking.status,
          mergeGroupId: rpcRow?.mergeGroupId ?? mergedGroupId ?? undefined,
          mergeType: plan.mergeType,
        };
        const existing = schedule.get(table.id) ?? [];
        existing.push(updateEntry);
        schedule.set(table.id, existing);
      }

      return { tableIds };
    } catch (error) {
      if (error instanceof AtomicAssignmentError) {
        const message = (error.message ?? "").toLowerCase();
        if (error.code === "P0001" && message.includes("allocations_no_overlap")) {
          overlapError = error;
          continue;
        }
      }
      console.error("[capacity][autoAssign] atomic assignment failed", {
        bookingId: booking.id,
        tableIds,
        error,
      });
      return {
        reason: error instanceof Error ? error.message : "Failed to assign tables",
      };
    }
  }

  if (overlapError) {
    return {
      reason: "All candidate table plans conflicted with existing allocations.",
    };
  }

  return {
    reason: fallbackReason ?? "Unable to assign tables for the requested booking.",
  };
}

type BookingRowWithAssignments = BookingRecordForAssignment & {
  booking_table_assignments: { table_id: string | null }[] | null;
};

type AssignmentContext = {
  tables: Table[];
  bookings: BookingRowWithAssignments[];
  schedule: Map<string, TableScheduleEntry[]>;
  policy: VenuePolicy;
  adjacency: Map<string, Set<string>>;
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
          category,
          seating_type,
          mobility,
          zone_id,
          status,
          active,
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

  const tables: Table[] = (tablesResult.data ?? []).map((row: any) => {
    const mergeEligible =
      row?.category === "dining" &&
      row?.seating_type === "standard" &&
      row?.mobility === "movable" &&
      (row?.capacity === 2 || row?.capacity === 4);

    return {
      id: row.id,
      tableNumber: row.table_number,
      capacity: row.capacity,
      minPartySize: row.min_party_size,
      maxPartySize: row.max_party_size,
      section: row.section,
      category: row.category,
      seatingType: row.seating_type,
      mobility: row.mobility,
      zoneId: row.zone_id,
      status: row.status,
      active: row.active ?? true,
      mergeEligible,
      position: row.position ?? null,
    };
  });

  const adjacency = new Map<string, Set<string>>();
  const tableIds = tables.map((table) => table.id);

  if (tableIds.length > 0) {
    const adjacencyResult = await client
      .from("table_adjacencies")
      .select("table_a, table_b")
      .in("table_a", tableIds);

    if (adjacencyResult.error) {
      throw new Error(`Failed to load table adjacency: ${adjacencyResult.error.message}`);
    }

    for (const row of adjacencyResult.data ?? []) {
      const entries = adjacency.get(row.table_a) ?? new Set<string>();
      entries.add(row.table_b);
      adjacency.set(row.table_a, entries);
    }
  }

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

  return { tables, bookings, schedule, policy, adjacency };
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

  const { tables, bookings, schedule, policy, adjacency } = await loadAssignmentContext({ restaurantId, date, client });

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
      adjacency,
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
  client?: DbClient,
  options?: { idempotencyKey?: string | null }
): Promise<string> {
  const supabase = client ?? getServiceSupabaseClient();
  const useAtomic = isRpcAssignAtomicEnabled() && isAssignAtomicEnabled();

  if (useAtomic) {
    const assignments = await invokeAssignTablesAtomic({
      bookingId,
      tableIds: [tableId],
      assignedBy: assignedBy ?? null,
      idempotencyKey: options?.idempotencyKey ?? null,
      client: supabase,
    });

    const first = assignments[0];
    if (!first) {
      throw new Error("assign_tables_atomic returned no assignments");
    }
    return first.assignmentId ?? tableId;
  }

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
  const useAtomic = isRpcAssignAtomicEnabled() && isAssignAtomicEnabled();

  if (useAtomic) {
    const result = await invokeUnassignTablesAtomic({
      bookingId,
      tableIds: [tableId],
      client: supabase,
    });
    return result.length > 0;
  }

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

type AtomicAssignmentResult = {
  tableId: string;
  assignmentId: string | null;
  mergeGroupId: string | null;
};

async function fetchBookingForAtomic(bookingId: string, client: DbClient): Promise<BookingRowForAtomic> {
  const { data, error } = await client
    .from("bookings")
    .select("id, restaurant_id, booking_date, start_time, end_time, start_at, end_at, restaurants(timezone)")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load booking for atomic assignment: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const bookingRow = data as BookingRowForAtomicSupabase;
  const restaurant = Array.isArray(bookingRow.restaurants)
    ? bookingRow.restaurants[0] ?? null
    : bookingRow.restaurants ?? null;

  return {
    id: bookingRow.id,
    restaurant_id: bookingRow.restaurant_id,
    booking_date: bookingRow.booking_date,
    start_time: bookingRow.start_time,
    end_time: bookingRow.end_time,
    start_at: bookingRow.start_at,
    end_at: bookingRow.end_at,
    restaurants: restaurant,
  };
}

async function invokeAssignTablesAtomic(params: {
  bookingId: string;
  tableIds: string[];
  assignedBy?: string | null;
  idempotencyKey?: string | null;
  client: DbClient;
  window?: { range: string; start: string; end: string };
}): Promise<AtomicAssignmentResult[]> {
  const { bookingId, tableIds, assignedBy, idempotencyKey, client, window } = params;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new Error("assign_tables_atomic requires at least one table id");
  }

  let resolvedWindow = window ?? null;
  if (!resolvedWindow) {
    const booking = await fetchBookingForAtomic(bookingId, client);
    resolvedWindow = buildAssignmentWindowRange(booking);
  }

  const { data, error } = await client.rpc("assign_tables_atomic", {
    p_booking_id: bookingId,
    p_table_ids: tableIds,
    p_window: resolvedWindow.range,
    p_assigned_by: assignedBy ?? null,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) {
    throw AtomicAssignmentError.fromPostgrest(error);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    tableId: row.table_id as string,
    assignmentId: (row.assignment_id as string | null) ?? null,
    mergeGroupId: (row.merge_group_id as string | null) ?? null,
  }));
}

async function invokeUnassignTablesAtomic(params: {
  bookingId: string;
  tableIds?: string[];
  mergeGroupId?: string | null;
  client: DbClient;
}): Promise<Array<{ tableId: string; mergeGroupId: string | null }>> {
  const { bookingId, tableIds, mergeGroupId, client } = params;

  const { data, error } = await client.rpc("unassign_tables_atomic", {
    p_booking_id: bookingId,
    p_table_ids: tableIds && tableIds.length > 0 ? tableIds : null,
    p_merge_group_id: mergeGroupId ?? null,
  });

  if (error) {
    throw new Error(`Failed to unassign tables atomically: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    tableId: row.table_id as string,
    mergeGroupId: (row.merge_group_id as string | null) ?? null,
  }));
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
): Promise<TableAssignmentGroup[]> {
  const supabase = client ?? getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select(`
      table_id,
      merge_group_id,
      table_inventory (
        table_number,
        capacity,
        section
      ),
      merge_group:merge_group_id (
        id,
        capacity
      )
    `)
    .eq("booking_id", bookingId);

  if (error) {
    throw new Error(`Failed to get table assignments: ${error.message}`);
  }

  const groups = new Map<string, TableAssignmentGroup>();

  for (const assignment of data ?? []) {
    const tableId: string = assignment.table_id;
    const tableMeta = normalizeRelationshipRecord<TableInventoryRecord>(assignment.table_inventory);
    const groupId: string | null = assignment.merge_group_id ?? null;
    const groupKey = groupId ?? tableId;
    const mergeGroupCapacity = getMergeGroupCapacity(assignment.merge_group ?? null);

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        groupId,
        capacitySum: null,
        members: [],
      };
      if (groupId && mergeGroupCapacity !== null) {
        group.capacitySum = mergeGroupCapacity;
      } else if (!groupId) {
        const tableCapacity = getNumericCapacity(tableMeta?.capacity);
        if (tableCapacity !== null) {
          group.capacitySum = tableCapacity;
        }
      }
      groups.set(groupKey, group);
    }

    group.members.push({
      tableId,
      tableNumber: typeof tableMeta?.table_number === "string" ? tableMeta.table_number : "Unknown",
      capacity: typeof tableMeta?.capacity === "number" ? tableMeta.capacity : null,
      section: tableMeta?.section ?? null,
    });
  }

  return Array.from(groups.values()).map((group) => {
    if (group.capacitySum === null) {
      const computed = group.members.reduce((sum, member) => sum + (member.capacity ?? 0), 0);
      group.capacitySum = computed > 0 ? computed : null;
    }
    return {
      groupId: group.groupId,
      capacitySum: group.capacitySum,
      members: group.members,
    };
  });
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
