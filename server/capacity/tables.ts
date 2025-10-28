import { randomUUID } from "node:crypto";

import { DateTime } from "luxon";

import {
  bandDuration,
  getBufferConfig,
  getSelectorScoringConfig,
  getVenuePolicy,
  serviceEnd,
  whichService,
  type ServiceKey,
  type VenuePolicy,
  ServiceNotFoundError,
  ServiceOverrunError,
} from "./policy";
import { buildScoredTablePlans, type RankedTablePlan } from "./selector";
import {
  emitHoldConfirmed,
  emitRpcConflict,
  emitSelectorDecision,
  emitSelectorQuote,
  summarizeCandidate,
  type CandidateSummary,
} from "./telemetry";
import {
  AssignTablesRpcError,
  HoldConflictError,
  HoldNotFoundError,
  createTableHold,
  findHoldConflicts,
  listActiveHoldsForBooking,
  releaseTableHold,
  type CreateTableHoldInput,
  type HoldConflictInfo,
  type TableHold,
} from "./holds";
import { createAvailabilityBitset, markWindow, isWindowFree } from "./planner/bitset";

import {
  getAllocatorKMax,
  getAllocatorKMax as getAllocatorCombinationLimit,
  isAllocatorAdjacencyRequired,
  isAllocatorMergesEnabled,
  isAllocatorV2Enabled,
  isCombinationPlannerEnabled,
  isHoldsEnabled,
  isOpsMetricsEnabled,
  isSelectorScoringEnabled,
} from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";
import {
  AssignmentConflictError,
  AssignmentOrchestrator,
  AssignmentRepositoryError,
  AssignmentValidationError,
  SupabaseAssignmentRepository,
  createPlanSignature,
  normalizeTableIds,
} from "./v2";

import type { Database, Json, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

const DEFAULT_HOLD_TTL_SECONDS = 180;
const TABLE_RESOURCE_TYPE = "table";

export type Table = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize?: number | null;
  maxPartySize?: number | null;
  section?: string | null;
  category?: Tables<"table_inventory">["category"] | string | null;
  seatingType?: Tables<"table_inventory">["seating_type"] | string | null;
  mobility?: Tables<"table_inventory">["mobility"] | string | null;
  zoneId: string;
  status?: Tables<"table_inventory">["status"] | string | null;
  active?: boolean | null;
  position?: Tables<"table_inventory">["position"] | null;
};

export type TableMatchParams = {
  partySize: number;
  requireAdjacency?: boolean;
  avoidTableIds?: string[];
  zoneId?: string | null;
};

export type TableAssignmentMember = {
  tableId: string;
  assignmentId: string;
  startAt: string;
  endAt: string;
  mergeGroupId?: string | null;
};

export type TableAssignmentGroup = {
  bookingId: string;
  tableIds: string[];
  assignments: TableAssignmentMember[];
};

export type ManualSelectionCheck = {
  id: "capacity" | "zone" | "movable" | "adjacency" | "conflict" | "holds";
  status: "ok" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
};

export type ManualSelectionSummary = {
  tableCount: number;
  totalCapacity: number;
  slack: number;
  zoneId: string | null;
  tableNumbers: string[];
  partySize: number;
};

export type ManualValidationResult = {
  ok: boolean;
  summary: ManualSelectionSummary;
  checks: ManualSelectionCheck[];
};

export type ManualSelectionOptions = {
  bookingId: string;
  tableIds: string[];
  requireAdjacency?: boolean;
  excludeHoldId?: string | null;
  client?: DbClient;
};

export type ManualHoldOptions = ManualSelectionOptions & {
  createdBy: string;
  holdTtlSeconds?: number;
  holdExpiresAt?: string;
};

export type ManualHoldResult = {
  hold: TableHold | null;
  validation: ManualValidationResult;
};

export type AutoAssignResult = {
  assigned: Array<{ bookingId: string; tableIds: string[] }>;
  skipped: Array<{ bookingId: string; reason: string }>;
};

export type QuoteTablesOptions = {
  bookingId: string;
  zoneId?: string | null;
  maxTables?: number;
  requireAdjacency?: boolean;
  avoidTables?: string[];
  holdTtlSeconds?: number;
  createdBy: string;
  client?: DbClient;
};

export type QuoteTablesResult = {
  hold: TableHold | null;
  candidate: CandidateSummary | null;
  alternates: CandidateSummary[];
  nextTimes: string[];
  reason?: string;
};

export type ManualAssignmentConflict = {
  tableId: string;
  bookingId: string | null;
  startAt: string;
  endAt: string;
  source: "booking" | "hold";
};

export type ManualAssignmentContextHold = TableHold & {
  createdByName?: string | null;
  createdByEmail?: string | null;
  summary?: ManualSelectionSummary;
};

export type ManualAssignmentContext = {
  booking: Tables<"bookings">;
  tables: Table[];
  bookingAssignments: string[];
  holds: ManualAssignmentContextHold[];
  activeHold: ManualAssignmentContextHold | null;
  conflicts: ManualAssignmentConflict[];
  window: {
    startAt: string | null;
    endAt: string | null;
  };
};

type BookingRow = Tables<"bookings"> & {
  restaurants?: { timezone: string | null } | { timezone: string | null }[];
};

type ContextBookingRow = {
  id: string;
  party_size: number;
  status: string;
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  booking_date: string | null;
  seating_preference?: string | null;
  booking_table_assignments: Array<{ table_id: string | null }> | null;
};

type BusyWindow = {
  tableId: string;
  startAt: string;
  endAt: string;
  bookingId: string | null;
  source: "booking" | "hold";
};

type AvailabilityMap = Map<
  string,
  {
    bitset: ReturnType<typeof createAvailabilityBitset>;
    windows: BusyWindow[];
  }
>;

export class ManualSelectionInputError extends Error {
  constructor(
    message: string,
    public readonly code: string = "MANUAL_SELECTION_INPUT_INVALID",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ManualSelectionInputError";
  }
}

function ensureClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function toDateTime(iso: string | null | undefined, fallbackZone: string): DateTime | null {
  if (!iso) {
    return null;
  }
  const parsed = DateTime.fromISO(iso, { zone: fallbackZone });
  if (parsed.isValid) {
    return parsed;
  }
  return DateTime.fromISO(iso);
}

function normalizeBookingRow(row: BookingRow): BookingRow {
  if (Array.isArray(row.restaurants) && row.restaurants.length > 0) {
    return { ...row, restaurants: row.restaurants[0] ?? null };
  }
  return row;
}

export type BookingWindow = ReturnType<typeof computeBookingWindow>;

export function computeBookingWindow(args: {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  policy?: VenuePolicy;
  serviceHint?: ServiceKey | null;
}): {
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
} {
  const policy = args.policy ?? getVenuePolicy();
  const baseStart = resolveStartDateTime(args, policy);
  const service = resolveService(baseStart, args.serviceHint ?? null, policy);

  const diningMinutes = bandDuration(service, args.partySize, policy);
  const buffer = getBufferConfig(service, policy);
  const diningStart = baseStart;
  const diningEnd = diningStart.plus({ minutes: diningMinutes });
  const blockStart = diningStart.minus({ minutes: buffer.pre ?? 0 });
  const blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });

  const serviceEndBoundary = serviceEnd(service, diningStart, policy);
  if (blockEnd > serviceEndBoundary) {
    throw new ServiceOverrunError(service, blockEnd, serviceEndBoundary);
  }

  return {
    service,
    durationMinutes: diningMinutes,
    dining: {
      start: diningStart,
      end: diningEnd,
    },
    block: {
      start: blockStart,
      end: blockEnd,
    },
  };
}

type ComputeWindowArgs = {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  policy?: VenuePolicy;
  serviceHint?: ServiceKey | null;
};

function computeBookingWindowWithFallback(args: ComputeWindowArgs): BookingWindow {
  const policy = args.policy ?? getVenuePolicy();
  try {
    return computeBookingWindow({ ...args, policy });
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      const serviceOrderCandidates = policy.serviceOrder.filter((key) => Boolean(policy.services[key]));
      const servicesFallback = (Object.keys(policy.services) as ServiceKey[]).filter((key) =>
        Boolean(policy.services[key]),
      );
      const fallbackService =
        args.serviceHint && policy.services[args.serviceHint]
          ? args.serviceHint
          : serviceOrderCandidates[0] ?? servicesFallback[0];

      if (!fallbackService || !policy.services[fallbackService]) {
        throw error;
      }

      const baseStart = resolveStartDateTime(args, policy);
      const durationMinutes = bandDuration(fallbackService, args.partySize, policy);
      const buffer = getBufferConfig(fallbackService, policy);
      const diningStart = baseStart;
      const diningEnd = diningStart.plus({ minutes: durationMinutes });
      const blockStart = diningStart.minus({ minutes: buffer.pre ?? 0 });
      const blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });

      console.warn("[capacity][window][fallback] service not found, using fallback service", {
        start: baseStart.toISO(),
        fallbackService,
      });

      return {
        service: fallbackService,
        durationMinutes,
        dining: {
          start: diningStart,
          end: diningEnd,
        },
        block: {
          start: blockStart,
          end: blockEnd,
        },
      };
    }

    throw error;
  }
}

function resolveStartDateTime(
  args: {
    startISO?: string | null;
    bookingDate?: string | null;
    startTime?: string | null;
  },
  policy: VenuePolicy,
): DateTime {
  if (args.startISO) {
    const parsed = DateTime.fromISO(args.startISO);
    if (!parsed.isValid) {
      throw new ManualSelectionInputError("Invalid start ISO timestamp provided", "INVALID_START");
    }
    return parsed.setZone(policy.timezone, { keepLocalTime: false });
  }

  const { bookingDate, startTime } = args;
  if (!bookingDate || !startTime) {
    throw new ManualSelectionInputError("Booking date and start time are required", "START_TIME_REQUIRED");
  }

  const composed = DateTime.fromISO(`${bookingDate}T${startTime}`, { zone: policy.timezone });
  if (!composed.isValid) {
    throw new ManualSelectionInputError("Invalid booking date/time", "INVALID_START");
  }
  return composed;
}

function resolveService(start: DateTime, hint: ServiceKey | null, policy: VenuePolicy): ServiceKey {
  if (hint) {
    return hint;
  }
  const found = whichService(start, policy);
  if (!found) {
    throw new ServiceNotFoundError(start);
  }
  return found;
}

export function windowsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

function toIsoUtc(dateTime: DateTime): string {
  return (
    dateTime.toUTC().toISO({ suppressMilliseconds: true }) ??
    dateTime.toUTC().toISO() ??
    dateTime.toUTC().toString()
  );
}

function normalizeIsoString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value);
  if (!parsed.isValid) {
    return null;
  }
  return toIsoUtc(parsed);
}

export function filterAvailableTables(
  tables: Table[],
  partySize: number,
  window: ReturnType<typeof computeBookingWindow>,
  adjacency: Map<string, Set<string>>,
  avoidTables?: Set<string>,
  zoneId?: string | null,
  options?: { allowInsufficientCapacity?: boolean },
): Table[] {
  const allowPartial = options?.allowInsufficientCapacity ?? false;
  const avoid = avoidTables ?? new Set<string>();

  const filtered = tables.filter((table) => {
    if (!table) return false;
    if (avoid.has(table.id)) return false;
    if (zoneId && table.zoneId !== zoneId) return false;
    if (table.active === false) return false;
    if (typeof table.status === "string" && table.status.toLowerCase() === "out_of_service") return false;
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) return false;
    if (!allowPartial && capacity < partySize) return false;
    if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
      return false;
    }
    if (typeof table.minPartySize === "number" && table.minPartySize > 0 && partySize < table.minPartySize) {
      return false;
    }
    // If adjacency map is supplied and requires zone-level adjacency, ensure entry exists.
    if (partiesRequireAdjacency(partySize) && adjacency.size > 0 && !adjacency.has(table.id)) {
      adjacency.set(table.id, new Set());
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const capacityDiff = (a.capacity ?? 0) - (b.capacity ?? 0);
    if (capacityDiff !== 0) return capacityDiff;
    return a.tableNumber.localeCompare(b.tableNumber);
  });
}

function partiesRequireAdjacency(_partySize: number): boolean {
  return false;
}

async function loadBooking(bookingId: string, client: DbClient): Promise<BookingRow> {
  const { data, error } = await client
    .from("bookings")
    .select(
      [
        "id",
        "restaurant_id",
        "booking_date",
        "start_time",
        "end_time",
        "start_at",
        "end_at",
        "party_size",
        "status",
        "seating_preference",
        "restaurants(timezone)",
      ].join(","),
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new ManualSelectionInputError(error.message ?? "Failed to load booking", "BOOKING_LOOKUP_FAILED", 500);
  }

  if (!data) {
    throw new ManualSelectionInputError("Booking not found", "BOOKING_NOT_FOUND", 404);
  }

  return normalizeBookingRow(data as unknown as BookingRow);
}

async function loadRestaurantTimezone(restaurantId: string, client: DbClient): Promise<string | null> {
  const { data, error } = await client
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) {
    throw new ManualSelectionInputError(error.message ?? "Failed to load restaurant timezone", "RESTAURANT_LOOKUP_FAILED", 500);
  }

  return data?.timezone ?? null;
}

async function loadTablesForRestaurant(restaurantId: string, client: DbClient): Promise<Table[]> {
  const { data, error } = await client
    .from("table_inventory")
    .select(
      [
        "id",
        "table_number",
        "capacity",
        "min_party_size",
        "max_party_size",
        "section",
        "category",
        "seating_type",
        "mobility",
        "zone_id",
        "status",
        "active",
        "position",
      ].join(","),
    )
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as Tables<"table_inventory">[];

  return rows.map((row) => ({
    id: row.id,
    tableNumber: row.table_number,
    capacity: row.capacity ?? 0,
    minPartySize: row.min_party_size ?? null,
    maxPartySize: row.max_party_size ?? null,
    section: row.section,
    category: row.category,
    seatingType: row.seating_type,
    mobility: row.mobility,
    zoneId: row.zone_id,
    status: row.status,
    active: row.active,
    position: row.position,
  }));
}

async function loadTablesByIds(
  restaurantId: string,
  tableIds: string[],
  client: DbClient,
): Promise<Table[]> {
  if (tableIds.length === 0) {
    return [];
  }

  const allTables = await loadTablesForRestaurant(restaurantId, client);
  const lookup = new Map(allTables.map((table) => [table.id, table]));

  return tableIds
    .map((id) => lookup.get(id))
    .filter((table): table is Table => Boolean(table));
}

async function loadAdjacency(tableIds: string[], client: DbClient): Promise<Map<string, Set<string>>> {
  if (tableIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("table_adjacencies")
    .select("table_a, table_b")
    .in("table_a", tableIds);

  if (error || !data) {
    return new Map();
  }

  const map = new Map<string, Set<string>>();
  for (const row of data) {
    if (!map.has(row.table_a)) {
      map.set(row.table_a, new Set());
    }
    map.get(row.table_a)!.add(row.table_b);
    if (!map.has(row.table_b)) {
      map.set(row.table_b, new Set());
    }
    map.get(row.table_b)!.add(row.table_a);
  }
  return map;
}

async function loadContextBookings(
  restaurantId: string,
  bookingDate: string | null,
  client: DbClient,
): Promise<ContextBookingRow[]> {
  if (!bookingDate) {
    return [];
  }

  const { data, error } = await client
    .from("bookings")
    .select(
      [
        "id",
        "party_size",
        "status",
        "start_time",
        "end_time",
        "start_at",
        "end_at",
        "booking_date",
        "booking_table_assignments(table_id)",
      ].join(","),
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .order("start_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as unknown as ContextBookingRow[];
}

async function loadBookingAssignments(bookingId: string, client: DbClient): Promise<TableAssignmentMember[]> {
  const { data, error } = await client
    .from("booking_table_assignments")
    .select("table_id, id, assigned_at")
    .eq("booking_id", bookingId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    tableId: row.table_id,
    assignmentId: row.id,
    startAt: row.assigned_at ?? "",
    endAt: row.assigned_at ?? "",
    mergeGroupId: null,
  }));
}

type BookingAssignmentRow = {
  table_id: string;
  id: string;
  start_at: string | null;
  end_at: string | null;
  merge_group_id: string | null;
};

async function loadTableAssignmentsForTables(
  bookingId: string,
  tableIds: string[],
  client: DbClient,
): Promise<BookingAssignmentRow[]> {
  const baseBuilder = client
    .from("booking_table_assignments")
    .select("table_id, id, start_at, end_at, merge_group_id")
    .eq("booking_id", bookingId);

  let data: any;
  let error: any;

  const builder: any = baseBuilder;
  if (builder && typeof builder.in === "function") {
    const response = await builder.in(
      "table_id",
      tableIds,
    );
    data = response?.data ?? null;
    error = response?.error ?? null;
  } else {
    const response = await builder;
    data = response?.data ?? null;
    error = response?.error ?? null;
  }

  if (error || !data) {
    return [];
  }

  return (data as BookingAssignmentRow[]).filter((row) => tableIds.includes(row.table_id));
}

function registerBusyWindow(
  map: AvailabilityMap,
  tableId: string,
  window: { startAt: string; endAt: string; bookingId: string | null; source: "booking" | "hold" },
): void {
  if (!map.has(tableId)) {
    map.set(tableId, {
      bitset: createAvailabilityBitset(),
      windows: [],
    });
  }
  const entry = map.get(tableId)!;
  markWindow(entry.bitset, window.startAt, window.endAt);
  entry.windows.push({
    tableId,
    ...window,
  });
}

function buildBusyMaps(params: {
  targetBookingId: string;
  bookings: ContextBookingRow[];
  holds: TableHold[];
  excludeHoldId?: string | null;
  policy: VenuePolicy;
}): AvailabilityMap {
  const { targetBookingId, bookings, holds, excludeHoldId, policy } = params;
  const map: AvailabilityMap = new Map();

  for (const booking of bookings) {
    if (booking.id === targetBookingId) continue;
    const assignments = booking.booking_table_assignments ?? [];
    if (assignments.length === 0) continue;

    const window = computeBookingWindowWithFallback({
      startISO: booking.start_at,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      partySize: booking.party_size,
      policy,
    });

    for (const assignment of assignments) {
      if (!assignment?.table_id) continue;
      registerBusyWindow(map, assignment.table_id, {
        startAt: toIsoUtc(window.block.start),
        endAt: toIsoUtc(window.block.end),
        bookingId: booking.id,
        source: "booking",
      });
    }
  }

  for (const hold of holds) {
    if (excludeHoldId && hold.id === excludeHoldId) continue;
    for (const tableId of hold.tableIds) {
      registerBusyWindow(map, tableId, {
        startAt: hold.startAt,
        endAt: hold.endAt,
        bookingId: hold.bookingId,
        source: "hold",
      });
    }
  }

  return map;
}

function extractConflictsForTables(
  busy: AvailabilityMap,
  tableIds: string[],
  window: ReturnType<typeof computeBookingWindow>,
): ManualAssignmentConflict[] {
  const conflicts: ManualAssignmentConflict[] = [];
  const targetStart = toIsoUtc(window.block.start);
  const targetEnd = toIsoUtc(window.block.end);

  for (const tableId of tableIds) {
    const entry = busy.get(tableId);
    if (!entry) continue;
    for (const other of entry.windows) {
      if (windowsOverlapMs(targetStart, targetEnd, other.startAt, other.endAt)) {
        conflicts.push({
          tableId,
          bookingId: other.bookingId,
          startAt: other.startAt,
          endAt: other.endAt,
          source: other.source,
        });
      }
    }
  }

  return conflicts;
}

function formatConflictSummary(conflicts: ManualAssignmentConflict[]): string {
  if (conflicts.length === 0) {
    return "conflicts";
  }

  const sources = new Set(conflicts.map((conflict) => conflict.source));
  const tableIds = Array.from(new Set(conflicts.map((conflict) => conflict.tableId))).join(", ");
  if (sources.size === 0) {
    return tableIds ? `conflicts on tables ${tableIds}` : "conflicts";
  }

  if (sources.size > 1) {
    return tableIds ? `holds and bookings on tables ${tableIds}` : "holds and bookings";
  }

  const [source] = sources;
  const label = source === "hold" ? "holds" : "bookings";
  return tableIds ? `${label} on tables ${tableIds}` : label;
}

function windowsOverlapMs(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a = { start: Date.parse(aStart), end: Date.parse(aEnd) };
  const b = { start: Date.parse(bStart), end: Date.parse(bEnd) };
  if (!Number.isFinite(a.start) || !Number.isFinite(a.end) || !Number.isFinite(b.start) || !Number.isFinite(b.end)) {
    return false;
  }
  return a.start < b.end && b.start < a.end;
}

function evaluateAdjacency(
  tableIds: string[],
  adjacency: Map<string, Set<string>>,
): { connected: boolean } {
  if (tableIds.length <= 1) {
    return { connected: true };
  }
  const queue = [tableIds[0]!];
  const visited = new Set<string>([tableIds[0]!]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!tableIds.includes(neighbor)) continue;
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return { connected: visited.size === tableIds.length };
}

function summarizeSelection(tables: Table[], partySize: number): ManualSelectionSummary {
  const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const zoneIds = new Set(tables.map((table) => table.zoneId));
  return {
    tableCount: tables.length,
    totalCapacity,
    slack: Math.max(0, totalCapacity - partySize),
    zoneId: zoneIds.size === 1 ? tables[0]?.zoneId ?? null : null,
    tableNumbers: tables.map((table) => table.tableNumber),
    partySize,
  };
}

function buildManualChecks(params: {
  summary: ManualSelectionSummary;
  tables: Table[];
  requireAdjacency: boolean;
  adjacency: Map<string, Set<string>>;
  conflicts: ManualAssignmentConflict[];
  holdConflicts: HoldConflictInfo[];
}): ManualSelectionCheck[] {
  const checks: ManualSelectionCheck[] = [];
  const { summary, tables, requireAdjacency, adjacency, conflicts, holdConflicts } = params;

  checks.push({
    id: "capacity",
    status: summary.totalCapacity >= summary.partySize ? "ok" : "error",
    message:
      summary.totalCapacity >= summary.partySize
        ? "Capacity satisfied"
        : "Selected tables do not meet requested party size",
    details: {
      totalCapacity: summary.totalCapacity,
      partySize: summary.partySize,
      slack: summary.slack,
    },
  });

  if (summary.zoneId === null) {
    checks.push({
      id: "zone",
      status: "error",
      message: "Tables must belong to the same zone for manual assignment",
    });
  } else {
    checks.push({
      id: "zone",
      status: "ok",
      message: `Zone ${summary.zoneId} validated`,
    });
  }

  if (tables.length > 1) {
    const allMovable = tables.every((table) => table.mobility === "movable");
    checks.push({
      id: "movable",
      status: allMovable ? "ok" : "error",
      message: allMovable
        ? "All tables are movable"
        : "Merged assignments require movable tables",
    });
  } else {
    checks.push({
      id: "movable",
      status: "ok",
      message: "Single table selection",
    });
  }

  if (requireAdjacency && tables.length > 1) {
    const evaluation = evaluateAdjacency(
      tables.map((table) => table.id),
      adjacency,
    );
    checks.push({
      id: "adjacency",
      status: evaluation.connected ? "ok" : "error",
      message: evaluation.connected
        ? "Tables are connected"
        : "Tables must be adjacent when adjacency enforcement is enabled",
    });
  } else {
    checks.push({
      id: "adjacency",
      status: "ok",
      message: "Adjacency not required",
    });
  }

  checks.push({
    id: "conflict",
    status: conflicts.length === 0 && holdConflicts.length === 0 ? "ok" : "error",
    message:
      conflicts.length === 0 && holdConflicts.length === 0
        ? "No conflicting assignments"
        : "Existing assignments or holds conflict with selection",
    details: {
      conflicts,
      holdConflicts,
    },
  });

  checks.push({
    id: "holds",
    status: holdConflicts.length === 0 ? "ok" : "error",
    message: holdConflicts.length === 0 ? "No holds blocking selection" : "Tables currently on hold",
    details: {
      holds: holdConflicts,
    },
  });

  return checks;
}

export async function evaluateManualSelection(options: ManualSelectionOptions): Promise<ManualValidationResult> {
  const { bookingId, tableIds, requireAdjacency = isAllocatorAdjacencyRequired(), excludeHoldId = null, client } = options;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new ManualSelectionInputError("At least one table must be selected", "TABLES_REQUIRED");
  }

  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });

  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("One or more selected tables were not found", "TABLE_LOOKUP_FAILED");
  }

  const adjacency = await loadAdjacency(tableIds, supabase);

  const contextBookings = await loadContextBookings(booking.restaurant_id, booking.booking_date ?? null, supabase);
  let holds: TableHold[] = [];
  if (isHoldsEnabled()) {
    try {
      holds = await listActiveHoldsForBooking({ bookingId, client: supabase });
    } catch (error) {
      holds = [];
    }
  }

  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds,
    excludeHoldId,
    policy,
  });

  const conflicts = extractConflictsForTables(busy, tableIds, window);
  let holdConflicts: HoldConflictInfo[] = [];
  try {
    holdConflicts = await findHoldConflicts({
      restaurantId: booking.restaurant_id,
      tableIds,
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
      excludeHoldId,
      client: supabase,
    });
  } catch (error) {
    holdConflicts = [];
  }

  const summary = summarizeSelection(selectionTables, booking.party_size);
  const checks = buildManualChecks({
    summary,
    tables: selectionTables,
    requireAdjacency,
    adjacency,
    conflicts,
    holdConflicts,
  });

  const ok = checks.every((check) => check.status !== "error");

  return {
    ok,
    summary,
    checks,
  };
}

export async function createManualHold(options: ManualHoldOptions): Promise<ManualHoldResult> {
  const { bookingId, tableIds, createdBy, holdTtlSeconds = DEFAULT_HOLD_TTL_SECONDS, requireAdjacency, excludeHoldId, client } = options;
  const supabase = ensureClient(client);

  const validation = await evaluateManualSelection({
    bookingId,
    tableIds,
    requireAdjacency,
    excludeHoldId,
    client: supabase,
  });

  if (!validation.ok || !validation.summary) {
    return {
      hold: null,
      validation,
    };
  }

  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });

  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("Selected tables could not be loaded", "TABLE_LOOKUP_FAILED");
  }

  const startAtIso = toIsoUtc(window.block.start);
  const endAtIso = toIsoUtc(window.block.end);

  if (excludeHoldId) {
    await releaseTableHold({ holdId: excludeHoldId, client: supabase });
  }

  const expiresAt =
    options.holdExpiresAt ??
    toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })) ??
    toIsoUtc(window.block.start.plus({ minutes: 2 }));

  const zoneIdValue = validation.summary.zoneId ?? selectionTables[0]?.zoneId;
  if (!zoneIdValue) {
    throw new ManualSelectionInputError("Unable to determine zone for selected tables", "ZONE_REQUIRED");
  }

  const holdPayload: CreateTableHoldInput = {
    bookingId,
    restaurantId: booking.restaurant_id,
    zoneId: zoneIdValue,
    tableIds,
    startAt: startAtIso,
    endAt: endAtIso,
    expiresAt,
    createdBy,
    metadata: {
      selection: {
        tableIds,
        summary: validation.summary,
      },
    },
    client: supabase,
  };

  const hold = await createTableHold(holdPayload);

  return {
    hold,
    validation,
  };
}

export async function getManualAssignmentContext(options: {
  bookingId: string;
  client?: DbClient;
}): Promise<ManualAssignmentContext> {
  const { bookingId, client } = options;
  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);

  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });

  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const contextBookings = await loadContextBookings(booking.restaurant_id, booking.booking_date ?? null, supabase);

  let holds: ManualAssignmentContextHold[] = [];
  if (isHoldsEnabled()) {
    try {
      const rawHolds = await fetchHoldsForWindow(booking.restaurant_id, window, supabase);
      holds = await hydrateHoldMetadata(rawHolds, supabase);
    } catch (error: any) {
      if (error?.code === "42P01") {
        console.warn("[capacity][manual][context] holds table unavailable; skipping hold hydration", {
          bookingId,
        });
      } else {
        console.warn("[capacity][manual][context] failed to list holds", { bookingId, error });
      }
      holds = [];
    }
  }

  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds,
    policy,
  });

  const bookingAssignments = await loadTableAssignmentsForTables(
    bookingId,
    tables.map((table) => table.id),
    supabase,
  );

  const conflicts = extractConflictsForTables(
    busy,
    tables.map((table) => table.id),
    window,
  );

  const activeHold = holds.find((hold) => hold.bookingId === bookingId) ?? null;

  return {
    booking,
    tables,
    bookingAssignments: bookingAssignments.map((row) => row.table_id),
    holds,
    activeHold,
    conflicts,
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
  };
}

async function hydrateHoldMetadata(holds: TableHold[], client: DbClient): Promise<ManualAssignmentContextHold[]> {
  if (holds.length === 0) {
    return [];
  }
  const creatorIds = Array.from(
    new Set(
      holds
        .map((hold) => hold.createdBy)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let creators: Array<{ id: string; name: string | null; email: string | null }> = [];
  if (creatorIds.length > 0) {
    const { data, error } = await client
      .from("profiles")
      .select("id, name, email")
      .in("id", creatorIds);

    if (!error && data) {
      creators = data as Array<{ id: string; name: string | null; email: string | null }>;
    }
  }

  return holds.map((hold) => {
    const creator = creators.find((profile) => profile.id === hold.createdBy);
    return {
      ...hold,
      createdByName: creator?.name ?? null,
      createdByEmail: creator?.email ?? null,
    };
  });
}

async function fetchHoldsForWindow(
  restaurantId: string,
  window: ReturnType<typeof computeBookingWindow>,
  client: DbClient,
): Promise<TableHold[]> {
  const { data, error } = await client
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", toIsoUtc(window.block.end))
    .gt("end_at", toIsoUtc(window.block.start));

  if (error || !data) {
    throw error ?? new Error("Failed to load holds");
  }

  return data.map((row: any) => {
    const members = (row.table_hold_members ?? []) as Array<{ table_id: string }>;
    const tableIds = members.map((member) => member.table_id);
    return {
      id: row.id,
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      zoneId: row.zone_id,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
      tableIds,
      createdBy: row.created_by ?? null,
      metadata: row.metadata ?? null,
    } satisfies TableHold;
  });
}

async function loadActiveHoldsForDate(
  restaurantId: string,
  bookingDate: string | null,
  policy: VenuePolicy,
  client: DbClient,
): Promise<TableHold[]> {
  if (!bookingDate) {
    return [];
  }

  const day = DateTime.fromISO(bookingDate, { zone: policy.timezone ?? "UTC" });
  if (!day.isValid) {
    return [];
  }

  const dayStart = toIsoUtc(day.startOf("day"));
  const dayEnd = toIsoUtc(day.plus({ days: 1 }).startOf("day"));
  const now = toIsoUtc(DateTime.now());

  const { data, error } = await client
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .gt("expires_at", now)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);

  if (error || !data) {
    throw error ?? new Error("Failed to load holds");
  }

  return data.map((row: any) => {
    const members = (row.table_hold_members ?? []) as Array<{ table_id: string }>;
    const tableIds = members.map((member) => member.table_id);
    return {
      id: row.id,
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      zoneId: row.zone_id,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
      tableIds,
      createdBy: row.created_by ?? null,
      metadata: row.metadata ?? null,
    } satisfies TableHold;
  });
}

type RawAssignmentRecord = {
  tableId: string;
  startAt?: string | null;
  endAt?: string | null;
  mergeGroupId?: string | null;
};

type AssignmentSyncParams = {
  supabase: DbClient;
  booking: BookingRow;
  tableIds: string[];
  idempotencyKey: string | null;
  assignments: RawAssignmentRecord[];
  startIso: string;
  endIso: string;
  actorId?: string | null;
  mergeGroupId?: string | null;
  holdContext?: {
    holdId: string;
    zoneId?: string | null;
  };
};

function serializeDetails(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

async function synchronizeAssignments(params: AssignmentSyncParams): Promise<TableAssignmentMember[]> {
  const { supabase, booking, tableIds, idempotencyKey, assignments, startIso, endIso, actorId, mergeGroupId, holdContext } = params;
  const uniqueTableIds = Array.from(new Set(tableIds));
  const assignmentRows = await loadTableAssignmentsForTables(booking.id, uniqueTableIds, supabase);
  const windowRange = `[${startIso},${endIso})`;

  const needsUpdate = assignments.some((assignment) => {
    const normalizedStart = normalizeIsoString(assignment.startAt ?? null);
    const normalizedEnd = normalizeIsoString(assignment.endAt ?? null);
    return normalizedStart !== startIso || normalizedEnd !== endIso;
  });

  if (needsUpdate) {
    try {
      await supabase
        .from("booking_table_assignments")
        .update({ start_at: startIso, end_at: endIso })
        .eq("booking_id", booking.id)
        .in("table_id", uniqueTableIds);
    } catch {
      // Ignore in mocked environments.
    }

    try {
      await supabase
        .from("allocations")
        .update({ window: windowRange })
        .eq("booking_id", booking.id)
        .eq("resource_type", TABLE_RESOURCE_TYPE)
        .in("resource_id", uniqueTableIds);
    } catch {
      // Ignore missing allocation support in mocked environments.
    }

    if (idempotencyKey) {
      try {
        await supabase
          .from("booking_assignment_idempotency")
          .update({
            assignment_window: windowRange,
            merge_group_allocation_id: mergeGroupId ?? null,
          })
          .eq("booking_id", booking.id)
          .eq("idempotency_key", idempotencyKey);
      } catch {
        // Ignore ledger updates in mocked environments.
      }
    }
  }

  const assignmentLookup = new Map<string, RawAssignmentRecord>();
  for (const assignment of assignments) {
    assignmentLookup.set(assignment.tableId, assignment);
  }

  const tableRowLookup = new Map(assignmentRows.map((row) => [row.table_id, row]));

  const result: TableAssignmentMember[] = uniqueTableIds.map((tableId) => {
    const row = tableRowLookup.get(tableId);
    const assignment = assignmentLookup.get(tableId);
    return {
      tableId,
      assignmentId: row?.id ?? randomUUID(),
      startAt: startIso,
      endAt: endIso,
      mergeGroupId: assignment?.mergeGroupId ?? mergeGroupId ?? null,
    };
  });

  if (holdContext) {
    await emitHoldConfirmed({
      holdId: holdContext.holdId,
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
      zoneId: holdContext.zoneId ?? result[0]?.tableId ?? "",
      tableIds: result.map((assignment) => assignment.tableId),
      startAt: startIso,
      endAt: endIso,
      expiresAt: endIso,
      actorId: actorId ?? null,
    });
  }

  return result;
}

export async function confirmHoldAssignment(options: {
  holdId: string;
  bookingId: string;
  idempotencyKey: string;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  client?: DbClient;
}): Promise<TableAssignmentMember[]> {
  if (!isAllocatorV2Enabled()) {
    throw new AssignTablesRpcError({
      message: "Allocator v2 must be enabled to confirm holds",
      code: "ALLOCATOR_V2_DISABLED",
      details: null,
      hint: "Enable allocator.v2.enabled to use confirmHoldAssignment",
    });
  }

  const { holdId, bookingId, idempotencyKey, requireAdjacency = isAllocatorAdjacencyRequired(), assignedBy = null, client } = options;
  const supabase = ensureClient(client);

  const {
    data: holdRow,
    error: holdError,
  } = await supabase
    .from("table_holds")
    .select("restaurant_id, zone_id, table_hold_members(table_id)")
    .eq("id", holdId)
    .maybeSingle();

  if (holdError) {
    throw new HoldNotFoundError(holdError.message ?? "Failed to load table hold");
  }

  if (!holdRow) {
    throw new HoldNotFoundError();
  }

  const tableIds = Array.isArray(holdRow.table_hold_members)
    ? (holdRow.table_hold_members as Array<{ table_id: string }>).map((member) => member.table_id)
    : [];

  if (tableIds.length === 0) {
    throw new AssignTablesRpcError({
      message: "Hold has no tables",
      code: "HOLD_EMPTY",
      details: null,
      hint: null,
    });
  }

  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const startIso = toIsoUtc(window.block.start);
  const endIso = toIsoUtc(window.block.end);
  const normalizedTableIds = normalizeTableIds(tableIds);
  const planSignature = createPlanSignature({
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
  });

  const orchestrator = new AssignmentOrchestrator(new SupabaseAssignmentRepository(supabase));
  let response;
  try {
    response = await orchestrator.commitPlan(
      {
        bookingId,
        restaurantId: booking.restaurant_id,
        partySize: booking.party_size,
        zoneId: holdRow.zone_id,
        serviceDate: booking.booking_date ?? null,
        window: {
          startAt: startIso,
          endAt: endIso,
        },
        holdId,
      },
      {
        signature: planSignature,
        tableIds: normalizedTableIds,
        startAt: startIso,
        endAt: endIso,
        metadata: {
          holdId,
        },
      },
      {
        source: "manual",
        idempotencyKey,
        actorId: assignedBy,
        metadata: {
          requireAdjacency,
          holdId,
        },
        requireAdjacency,
      },
    );
  } catch (error) {
    if (error instanceof AssignmentConflictError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_CONFLICT",
        details: serializeDetails(error.details),
        hint: error.details?.hint ?? null,
      });
    }

    if (error instanceof AssignmentValidationError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_VALIDATION",
        details: serializeDetails(error.details),
        hint: null,
      });
    }

    if (error instanceof AssignmentRepositoryError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_REPOSITORY_ERROR",
        details: serializeDetails(error.cause ?? null),
        hint: null,
      });
    }

    throw error;
  }

  try {
    await supabase.from("table_holds").delete().eq("id", holdId);
  } catch {
    // Best-effort cleanup.
  }

  return synchronizeAssignments({
    supabase,
    booking,
    tableIds: normalizedTableIds,
    idempotencyKey,
    assignments: response.assignments.map((assignment) => ({
      tableId: assignment.tableId,
      startAt: assignment.startAt,
      endAt: assignment.endAt,
      mergeGroupId: assignment.mergeGroupId ?? response.mergeGroupId ?? null,
    })),
    startIso,
    endIso,
    actorId: assignedBy,
    mergeGroupId: response.mergeGroupId ?? null,
    holdContext: {
      holdId,
      zoneId: holdRow.zone_id ?? null,
    },
  });
}

export async function assignTableToBooking(
  bookingId: string,
  tableIdOrIds: string | string[],
  assignedBy: string | null,
  client?: DbClient,
  options?: { idempotencyKey?: string | null; requireAdjacency?: boolean; booking?: BookingRow },
): Promise<string> {
  if (!isAllocatorV2Enabled()) {
    throw new AssignTablesRpcError({
      message: "Allocator v2 must be enabled to assign tables",
      code: "ALLOCATOR_V2_DISABLED",
      details: null,
      hint: "Enable allocator.v2.enabled to call assignTableToBooking",
    });
  }

  const supabase = ensureClient(client);
  const tableIds = Array.isArray(tableIdOrIds) ? tableIdOrIds : [tableIdOrIds];
  if (tableIds.length === 0) {
    throw new ManualSelectionInputError("Must provide at least one table id", "TABLES_REQUIRED");
  }

  const booking = options?.booking ?? (await loadBooking(bookingId, supabase));
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });
  const startIso = toIsoUtc(window.block.start);
  const endIso = toIsoUtc(window.block.end);
  const normalizedTableIds = normalizeTableIds(tableIds);
  const planSignature = createPlanSignature({
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    salt: options?.idempotencyKey ?? undefined,
  });
  const idempotencyKey = options?.idempotencyKey ?? planSignature;
  const requireAdjacency = options?.requireAdjacency ?? false;

  const orchestrator = new AssignmentOrchestrator(new SupabaseAssignmentRepository(supabase));
  let response;
  try {
    response = await orchestrator.commitPlan(
      {
        bookingId,
        restaurantId: booking.restaurant_id,
        partySize: booking.party_size,
        serviceDate: booking.booking_date ?? null,
        window: {
          startAt: startIso,
          endAt: endIso,
        },
      },
      {
        signature: planSignature,
        tableIds: normalizedTableIds,
        startAt: startIso,
        endAt: endIso,
        metadata: {
          requestSource: "assignTableToBooking",
        },
      },
      {
        source: "manual",
        idempotencyKey,
        actorId: assignedBy,
        metadata: {
          requireAdjacency,
        },
        requireAdjacency,
      },
    );
  } catch (error) {
    if (error instanceof AssignmentConflictError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_CONFLICT",
        details: serializeDetails(error.details),
        hint: error.details?.hint ?? null,
      });
    }

    if (error instanceof AssignmentValidationError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_VALIDATION",
        details: serializeDetails(error.details),
        hint: null,
      });
    }

    if (error instanceof AssignmentRepositoryError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_REPOSITORY_ERROR",
        details: serializeDetails(error.cause ?? null),
        hint: null,
      });
    }

    throw error;
  }

  const synchronized = await synchronizeAssignments({
    supabase,
    booking,
    tableIds: normalizedTableIds,
    idempotencyKey,
    assignments: response.assignments.map((assignment) => ({
      tableId: assignment.tableId,
      startAt: assignment.startAt,
      endAt: assignment.endAt,
      mergeGroupId: assignment.mergeGroupId ?? response.mergeGroupId ?? null,
    })),
    startIso,
    endIso,
    actorId: assignedBy,
    mergeGroupId: response.mergeGroupId ?? null,
  });

  const firstAssignment = synchronized[0];
  if (!firstAssignment) {
    throw new AssignTablesRpcError({
      message: "Assignment failed with no records returned",
      code: "ASSIGNMENT_EMPTY",
      details: null,
      hint: null,
    });
  }

  return firstAssignment.assignmentId;
}

export async function unassignTableFromBooking(
  bookingId: string,
  tableId: string,
  client?: DbClient,
): Promise<boolean> {
  const supabase = ensureClient(client);
  const { data, error } = await supabase.rpc("unassign_tables_atomic", {
    p_booking_id: bookingId,
    p_table_ids: [tableId],
  });
  if (error) {
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function getBookingTableAssignments(
  bookingId: string,
  client?: DbClient,
): Promise<TableAssignmentMember[]> {
  const supabase = ensureClient(client);
  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select("table_id, id, assigned_at")
    .eq("booking_id", bookingId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    tableId: row.table_id,
    assignmentId: row.id,
    startAt: row.assigned_at ?? "",
    endAt: row.assigned_at ?? "",
    mergeGroupId: null,
  }));
}

export async function quoteTablesForBooking(options: QuoteTablesOptions): Promise<QuoteTablesResult> {
  const {
    bookingId,
    zoneId,
    maxTables,
    requireAdjacency = isAllocatorAdjacencyRequired(),
    avoidTables = [],
    holdTtlSeconds = DEFAULT_HOLD_TTL_SECONDS,
    createdBy,
    client,
  } = options;

  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const adjacency = await loadAdjacency(
    tables.map((table) => table.id),
    supabase,
  );

  const filtered = filterAvailableTables(
    tables,
    booking.party_size,
    window,
    adjacency,
    new Set(avoidTables),
    zoneId ?? null,
    { allowInsufficientCapacity: true },
  );

  const scoringConfig = getSelectorScoringConfig();
  const plans = buildScoredTablePlans({
    tables: filtered,
    partySize: booking.party_size,
    adjacency,
    config: scoringConfig,
    enableCombinations: isCombinationPlannerEnabled(),
    kMax: maxTables ?? getAllocatorCombinationLimit(),
    requireAdjacency,
  });

  const alternates: CandidateSummary[] = [];

  for (let index = 0; index < plans.plans.length; index += 1) {
    const plan = plans.plans[index]!;
    const candidateSummary = summarizeCandidate({
      tableIds: plan.tables.map((table) => table.id),
      tableNumbers: plan.tables.map((table) => table.tableNumber),
      totalCapacity: plan.totalCapacity,
      tableCount: plan.tables.length,
      slack: plan.slack,
      score: plan.score,
      adjacencyStatus: plan.adjacencyStatus,
    });

    if (index > 0) {
      alternates.push(candidateSummary);
    }

    try {
      const summary = summarizeSelection(plan.tables, booking.party_size);
      const zoneForHold = summary.zoneId ?? plan.tables[0]?.zoneId;
      if (!zoneForHold) {
        continue;
      }

      const hold = await createTableHold({
        bookingId,
        restaurantId: booking.restaurant_id,
        zoneId: zoneForHold,
        tableIds: plan.tables.map((table) => table.id),
        startAt: toIsoUtc(window.block.start),
        endAt: toIsoUtc(window.block.end),
        expiresAt: toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })),
        createdBy,
        metadata: {
          selection: {
            tableIds: plan.tables.map((table) => table.id),
            summary,
          },
        },
        client: supabase,
      });

      await emitSelectorQuote({
        restaurantId: booking.restaurant_id,
        bookingId,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: [candidateSummary, ...alternates],
        selected: candidateSummary,
        durationMs: 0,
        featureFlags: {
          selectorScoring: isSelectorScoringEnabled(),
          opsMetrics: isOpsMetricsEnabled(),
        },
        diagnostics: plans.diagnostics,
        holdId: hold.id,
        expiresAt: hold.expiresAt,
      });

      return {
        hold,
        candidate: candidateSummary,
        alternates,
        nextTimes: [],
      };
    } catch (error) {
      if (error instanceof HoldConflictError) {
        const conflicts = await findHoldConflicts({
          restaurantId: booking.restaurant_id,
          tableIds: plan.tables.map((table) => table.id),
          startAt: toIsoUtc(window.block.start),
          endAt: toIsoUtc(window.block.end),
          client: supabase,
        });

        await emitRpcConflict({
          source: "create_hold_conflict",
          bookingId,
          restaurantId: booking.restaurant_id,
          tableIds: plan.tables.map((table) => table.id),
          holdId: error.holdId ?? null,
          error: {
            code: null,
            message: error.message,
            details: JSON.stringify(conflicts),
            hint: null,
          },
        });

        continue;
      }
      throw error;
    }
  }

  return {
    hold: null,
    candidate: null,
    alternates,
    nextTimes: [],
    reason: plans.fallbackReason ?? "No suitable tables available",
  };
}

export async function autoAssignTablesForDate(options: {
  restaurantId: string;
  date: string;
  client?: DbClient;
  assignedBy?: string | null;
}): Promise<AutoAssignResult> {
  const { restaurantId, date, client, assignedBy = null } = options;
  const supabase = ensureClient(client);
  const [bookings, tables, restaurantTimezone] = await Promise.all([
    loadContextBookings(restaurantId, date, supabase),
    loadTablesForRestaurant(restaurantId, supabase),
    loadRestaurantTimezone(restaurantId, supabase),
  ]);
  const adjacency = await loadAdjacency(
    tables.map((table) => table.id),
    supabase,
  );
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const adjacencyEdgeCount = Array.from(adjacency.values()).reduce((sum, neighbors) => sum + neighbors.size, 0);
  const requireAdjacencyForMerge = adjacencyEdgeCount > 0 && isAllocatorAdjacencyRequired();
  const combinationPlannerEnabled = isCombinationPlannerEnabled();
  const mergesEnabled = isAllocatorMergesEnabled();
  let activeHolds: TableHold[] = [];
  if (isHoldsEnabled()) {
    try {
      activeHolds = await loadActiveHoldsForDate(restaurantId, date, policy, supabase);
    } catch (error: any) {
      if (error?.code === "42P01") {
        console.warn("[ops][auto-assign] holds table unavailable; skipping hold hydration", {
          restaurantId,
        });
      } else {
        console.warn("[ops][auto-assign] failed to load active holds", {
          restaurantId,
          error,
        });
      }
      activeHolds = [];
    }
  }

  const result: AutoAssignResult = {
    assigned: [],
    skipped: [],
  };

  for (const booking of bookings) {
    const alreadyAssigned = (booking.booking_table_assignments ?? []).some((row) => Boolean(row.table_id));
    if (alreadyAssigned) {
      continue;
    }

    const featureFlags = {
      selectorScoring: isSelectorScoringEnabled(),
      opsMetrics: isOpsMetricsEnabled(),
    };

    let window: BookingWindow | null = null;
    let overrunReason: string | null = null;
    try {
      window = computeBookingWindowWithFallback({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize: booking.party_size,
        policy,
      });
    } catch (error) {
      if (error instanceof ServiceOverrunError) {
        overrunReason = error.message ?? "Reservation window exceeds service boundary";
      } else {
        throw error;
      }
    }
    if (!window) {
      const reason = overrunReason ?? "Reservation window exceeds service boundary";
      result.skipped.push({ bookingId: booking.id, reason });
      await emitSelectorDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: undefined,
        candidates: [],
        selected: null,
        skipReason: reason,
        durationMs: 0,
        featureFlags,
        diagnostics: undefined,
      });
      continue;
    }

    const availableTables = filterAvailableTables(
      tables,
      booking.party_size,
      window,
      adjacency,
      undefined,
      undefined,
      { allowInsufficientCapacity: true },
    );
    const scoringConfig = getSelectorScoringConfig();
    const runPlanner = (enableCombinations: boolean) =>
      buildScoredTablePlans({
        tables: availableTables,
        partySize: booking.party_size,
        adjacency,
        config: scoringConfig,
        enableCombinations,
        kMax: getAllocatorCombinationLimit(),
        requireAdjacency: requireAdjacencyForMerge,
      });
    let plans = runPlanner(combinationPlannerEnabled);

    if (plans.plans.length === 0 && !combinationPlannerEnabled) {
      if (mergesEnabled) {
        const mergeFallback = runPlanner(true);
        if (mergeFallback.plans.length > 0) {
          plans = mergeFallback;
        } else {
          plans = {
            ...mergeFallback,
            fallbackReason: mergeFallback.fallbackReason ?? "Combination planner disabled (requires merges)",
          };
        }
      } else if (!plans.fallbackReason) {
        plans = {
          ...plans,
          fallbackReason: "Combination planner disabled (requires merges)",
        };
      }
    }

    if (plans.plans.length === 0) {
      const fallback = plans.fallbackReason ?? "No suitable tables available";
      const skipReason = `No suitable tables available (${fallback})`;
      result.skipped.push({ bookingId: booking.id, reason: skipReason });
      await emitSelectorDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: [],
        selected: null,
        skipReason,
        durationMs: 0,
        featureFlags,
        diagnostics: plans.diagnostics,
      });
      continue;
    }

    const busy = buildBusyMaps({
      targetBookingId: booking.id,
      bookings,
      holds: activeHolds,
      policy,
    });

    const planEvaluations = plans.plans.map((plan) => ({
      plan,
      conflicts: extractConflictsForTables(
        busy,
        plan.tables.map((table) => table.id),
        window,
      ),
    }));

    const candidateSummariesAll: CandidateSummary[] = planEvaluations.map(({ plan }) =>
      summarizeCandidate({
        tableIds: plan.tables.map((table) => table.id),
        tableNumbers: plan.tables.map((table) => table.tableNumber),
        totalCapacity: plan.totalCapacity,
        tableCount: plan.tables.length,
        slack: plan.slack,
        score: plan.score,
        adjacencyStatus: plan.adjacencyStatus,
      }),
    );

    const conflictFreeEntries = planEvaluations.filter(({ conflicts }) => conflicts.length === 0);
    if (conflictFreeEntries.length === 0) {
      const conflictEntry = planEvaluations.find(({ conflicts }) => conflicts.length > 0);
      const conflictSummary = conflictEntry ? formatConflictSummary(conflictEntry.conflicts) : "conflicts";
      const skipReason = `Conflicts with existing ${conflictSummary}`;

      if (conflictEntry) {
        await emitRpcConflict({
          source: "auto_assign_conflict",
          bookingId: booking.id,
          restaurantId,
          tableIds: conflictEntry.plan.tables.map((table) => table.id),
          error: {
            code: null,
            message: skipReason,
            details: JSON.stringify(conflictEntry.conflicts),
            hint: null,
          },
        });
      }

      result.skipped.push({ bookingId: booking.id, reason: skipReason });
      await emitSelectorDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: candidateSummariesAll,
        selected: null,
        skipReason,
        durationMs: 0,
        featureFlags,
        diagnostics: plans.diagnostics,
      });
      continue;
    }

    const topEntry = conflictFreeEntries[0]!;
    const topPlan = topEntry.plan;
    const candidateSummaries: CandidateSummary[] = conflictFreeEntries.map(({ plan }) =>
      summarizeCandidate({
        tableIds: plan.tables.map((table) => table.id),
        tableNumbers: plan.tables.map((table) => table.tableNumber),
        totalCapacity: plan.totalCapacity,
        tableCount: plan.tables.length,
        slack: plan.slack,
        score: plan.score,
        adjacencyStatus: plan.adjacencyStatus,
      }),
    );
    const candidate = candidateSummaries[0]!;

    try {
      await assignTableToBooking(
        booking.id,
        topPlan.tables.map((table) => table.id),
        assignedBy,
        supabase,
        {
          idempotencyKey: randomUUID(),
          requireAdjacency: requireAdjacencyForMerge,
          booking: {
            ...(booking as any),
            id: booking.id,
            restaurant_id: restaurantId,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            start_at: booking.start_at,
            end_at: booking.end_at,
            party_size: booking.party_size,
            status: booking.status,
            seating_preference: booking.seating_preference ?? null,
            restaurants: { timezone: policy.timezone },
          } as BookingRow,
        },
      );
    } catch (error: any) {
      const message = error?.message ? String(error.message) : String(error);
      const normalized = message.toLowerCase();
      const overlap =
        normalized.includes("assignment overlap") || normalized.includes("allocations_no_overlap");

      if (!overlap) {
        throw error;
      }

      await emitRpcConflict({
        source: "auto_assign_overlap",
        bookingId: booking.id,
        restaurantId,
        tableIds: topPlan.tables.map((table) => table.id),
        error: {
          code: null,
          message,
          details: null,
          hint: null,
        },
      });

      const skipReason = "Auto assign skipped: Supabase reported an overlapping assignment";
      result.skipped.push({ bookingId: booking.id, reason: skipReason });
      await emitSelectorDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: candidateSummariesAll,
        selected: null,
        skipReason,
        durationMs: 0,
        featureFlags,
        diagnostics: plans.diagnostics,
      });
      continue;
    }

    if (!booking.booking_table_assignments) {
      booking.booking_table_assignments = [];
    }
    for (const table of topPlan.tables) {
      if (!booking.booking_table_assignments.some((assignment) => assignment?.table_id === table.id)) {
        booking.booking_table_assignments.push({ table_id: table.id });
      }
    }

    result.assigned.push({
      bookingId: booking.id,
      tableIds: topPlan.tables.map((table) => table.id),
    });

    await emitSelectorDecision({
      restaurantId,
      bookingId: booking.id,
      partySize: booking.party_size,
      window: {
        start: toIsoUtc(window.block.start),
        end: toIsoUtc(window.block.end),
      },
      candidates: candidateSummaries,
      selected: candidate,
      skipReason: null,
      durationMs: 0,
      featureFlags,
      diagnostics: plans.diagnostics,
    });
  }

  return result;
}

export async function autoAssignTables(options: {
  restaurantId: string;
  date: string;
  client?: DbClient;
  assignedBy?: string | null;
}): Promise<AutoAssignResult> {
  return autoAssignTablesForDate(options);
}

export async function findSuitableTables(options: {
  bookingId: string;
  client?: DbClient;
}): Promise<RankedTablePlan[]> {
  const { bookingId, client } = options;
  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);
  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const adjacency = await loadAdjacency(
    tables.map((table) => table.id),
    supabase,
  );
  const policy = getVenuePolicy();
  const window = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const filtered = filterAvailableTables(
    tables,
    booking.party_size,
    window,
    adjacency,
    undefined,
    undefined,
    { allowInsufficientCapacity: true },
  );
  const scoringConfig = getSelectorScoringConfig();
  const plans = buildScoredTablePlans({
    tables: filtered,
    partySize: booking.party_size,
    adjacency,
    config: scoringConfig,
    enableCombinations: isCombinationPlannerEnabled(),
    kMax: getAllocatorCombinationLimit(),
    requireAdjacency: isAllocatorAdjacencyRequired(),
  });

  return plans.plans;
}

export async function isTableAvailableV2(
  tableId: string,
  startISO: string,
  partySize: number,
  options?: {
    excludeBookingId?: string;
    policy?: VenuePolicy;
    client?: DbClient;
  },
): Promise<boolean> {
  const supabase = ensureClient(options?.client);
  const policy = options?.policy ?? getVenuePolicy();
  const window = computeBookingWindowWithFallback({
    startISO,
    partySize,
    policy,
  });

  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select("table_id, start_at, end_at, bookings(id, status, start_at, end_at)")
    .eq("table_id", tableId);

  if (error || !data) {
    return true;
  }

  for (const row of data) {
    const booking = (row as any).bookings;
    if (options?.excludeBookingId && booking?.id === options.excludeBookingId) {
      continue;
    }

    const otherStart = row.start_at ?? booking?.start_at;
    const otherEnd = row.end_at ?? booking?.end_at;
    if (!otherStart || !otherEnd) {
      continue;
    }

    if (
      windowsOverlapMs(
        toIsoUtc(window.block.start),
        toIsoUtc(window.block.end),
        otherStart,
        otherEnd,
      )
    ) {
      return false;
    }
  }

  return true;
}

export async function isTableAvailable(
  tableId: string,
  startISO: string,
  partySize: number,
  options?: {
    excludeBookingId?: string;
    policy?: VenuePolicy;
    client?: DbClient;
  },
): Promise<boolean> {
  return isTableAvailableV2(tableId, startISO, partySize, options);
}

export const __internal = {
  computeBookingWindow,
  windowsOverlap,
  filterAvailableTables,
};
