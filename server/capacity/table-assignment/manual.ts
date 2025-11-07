import { DateTime } from "luxon";

import { listActiveHoldsForBooking, createTableHold, findHoldConflicts, type HoldConflictInfo, type TableHold, type CreateTableHoldInput } from "@/server/capacity/holds";
import { getVenuePolicy, ServiceOverrunError } from "@/server/capacity/policy";
import { computePayloadChecksum, hashPolicyVersion } from "@/server/capacity/v2";
import { isHoldsEnabled, isHoldStrictConflictsEnabled, isAllocatorAdjacencyRequired, isAdjacencyQueryUndirected } from "@/server/feature-flags";

import { buildBusyMaps, extractConflictsForTables, resolveRequireAdjacency } from "./availability";
import { computeBookingWindowWithFallback } from "./booking-window";
import { DEFAULT_HOLD_TTL_SECONDS } from "./constants";
import { ensureClient, loadBooking, loadTablesByIds, loadTablesForRestaurant, loadAdjacency, loadContextBookings, fetchHoldsForWindow, loadTableAssignmentsForTables, loadRestaurantTimezone, releaseHoldWithRetry, extractErrorCode, type DbClient } from "./supabase";
import { ManualSelectionInputError, type ManualSelectionOptions, type ManualValidationResult, type ManualHoldOptions, type ManualHoldResult, type ManualSelectionSummary, type ManualSelectionCheck, type ManualAssignmentConflict, type ManualAssignmentContext, type ManualAssignmentContextHold, type Table, type BookingWindow } from "./types";
import { toIsoUtc, summarizeSelection } from "./utils";


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
  const { bookingId, tableIds, requireAdjacency: requireAdjacencyOverride, excludeHoldId = null, client } = options;

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
  const policyVersion = hashPolicyVersion(policy);

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
      // Surface a structured 422 that the API layer can return to the client
      // rather than bubbling a 500. Keeps math unchanged while avoiding crashes
      // in manual context fetches for after-hours/overrun bookings.
      throw new ManualSelectionInputError(error.message, "SERVICE_OVERRUN", 422);
    }
    throw error;
  }

  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("One or more selected tables were not found", "TABLE_LOOKUP_FAILED");
  }

  const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);

  const contextBookings = await loadContextBookings(
    booking.restaurant_id,
    booking.booking_date ?? null,
    supabase,
    {
      startIso: toIsoUtc(window.block.start),
      endIso: toIsoUtc(window.block.end),
    },
  );
  let holds: TableHold[] = [];
  if (isHoldsEnabled()) {
    try {
      holds = await listActiveHoldsForBooking({ bookingId, client: supabase });
    } catch {
      holds = [];
    }
  }

  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds,
    excludeHoldId,
    policy,
    targetWindow: window,
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
  } catch {
    holdConflicts = [];
  }

  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
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
    policyVersion,
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
  const policyVersion = typeof (validation as { policyVersion?: string }).policyVersion === "string"
    ? (validation as { policyVersion?: string }).policyVersion!
    : hashPolicyVersion(policy);

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
      throw new ManualSelectionInputError(error.message, "SERVICE_OVERRUN", 422);
    }
    throw error;
  }

  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("Selected tables could not be loaded", "TABLE_LOOKUP_FAILED");
  }

  const startAtIso = toIsoUtc(window.block.start);
  const endAtIso = toIsoUtc(window.block.end);

  const expiresAt =
    options.holdExpiresAt ??
    toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })) ??
    toIsoUtc(window.block.start.plus({ minutes: 2 }));

  const zoneIdValue = validation.summary.zoneId ?? selectionTables[0]?.zoneId;
  if (!zoneIdValue) {
    throw new ManualSelectionInputError("Unable to determine zone for selected tables", "ZONE_REQUIRED");
  }

  // Compute adjacency/zone snapshot for freeze semantics
  const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);
  const adjacencyUndirected = isAdjacencyQueryUndirected();
  const zoneIds = Array.from(new Set(selectionTables.map((t) => t.zoneId))).filter(Boolean) as string[];
  const edgeSet = new Set<string>();
  for (const a of tableIds) {
    const neighbors = adjacency.get(a);
    if (!neighbors) continue;
    for (const b of neighbors) {
      if (!tableIds.includes(b)) continue;
      const key = adjacencyUndirected
        ? ([a, b].sort((x, y) => x.localeCompare(y)) as [string, string]).join("->")
        : `${a}->${b}`;
      edgeSet.add(key);
    }
  }
  const normalizedEdges = Array.from(edgeSet).sort();
  const adjacencySnapshot = computePayloadChecksum({ undirected: adjacencyUndirected, edges: normalizedEdges });

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
        snapshot: {
          zoneIds,
          adjacency: {
            undirected: adjacencyUndirected,
            edges: normalizedEdges,
            hash: adjacencySnapshot,
          },
        },
      },
      policyVersion,
    },
    client: supabase,
  };

  const hold = await createTableHold(holdPayload);

  if (excludeHoldId) {
    try {
      await releaseHoldWithRetry({ holdId: excludeHoldId, client: supabase });
    } catch (error) {
      console.warn("[capacity][manual][holds] failed to release replaced hold", {
        bookingId,
        newHoldId: hold.id,
        previousHoldId: excludeHoldId,
        error,
      });
    }
  }

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
      throw new ManualSelectionInputError(error.message, "SERVICE_OVERRUN", 422);
    }
    throw error;
  }

  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const contextBookings = await loadContextBookings(
    booking.restaurant_id,
    booking.booking_date ?? null,
    supabase,
    {
      startIso: toIsoUtc(window.block.start),
      endIso: toIsoUtc(window.block.end),
    },
  );

  let holds: ManualAssignmentContextHold[] = [];
  if (isHoldsEnabled()) {
    try {
      const rawHolds = await fetchHoldsForWindow(booking.restaurant_id, window, supabase);
      holds = await hydrateHoldMetadata(rawHolds, supabase);
    } catch (error: unknown) {
      const code = extractErrorCode(error);
      if (code === "42P01") {
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
    targetWindow: window,
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

  // Compute context version from holds + assignments + flags + window
  const flags = {
    holdsStrictConflicts: isHoldStrictConflictsEnabled(),
    adjacencyRequired: isAllocatorAdjacencyRequired(),
    adjacencyUndirected: isAdjacencyQueryUndirected(),
  };
  const contextVersionPayload = {
    holds: holds.map((h) => ({ id: h.id, tableIds: h.tableIds, startAt: h.startAt, endAt: h.endAt })),
    assignments: bookingAssignments.map((row) => row.table_id),
    flags,
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
  };
  const contextVersion = computePayloadChecksum(contextVersionPayload);
  const serverNow = toIsoUtc(DateTime.now());

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
    flags,
    contextVersion,
    serverNow,
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
