import { DateTime } from "luxon";

import { evaluateAdjacency as evaluateAdjacencyGraph, isAdjacencySatisfied, summarizeAdjacencyStatus } from "@/server/capacity/adjacency";
import { listActiveHoldsForBooking, createTableHold, findHoldConflicts, type HoldConflictInfo, type TableHold, type CreateTableHoldInput } from "@/server/capacity/holds";
import { getSelectorScoringConfig, getVenuePolicy, ServiceOverrunError } from "@/server/capacity/policy";
import { computePayloadChecksum, hashPolicyVersion } from "@/server/capacity/v2";
import { getAllocatorAdjacencyMode, getManualAssignmentMaxSlack, isHoldsEnabled, isHoldStrictConflictsEnabled, isAllocatorAdjacencyRequired, isAdjacencyQueryUndirected } from "@/server/feature-flags";

import { buildBusyMaps, extractConflictsForTables, resolveRequireAdjacency } from "./availability";
import { computeBookingWindowWithFallback } from "./booking-window";
import { DEFAULT_HOLD_TTL_SECONDS } from "./constants";
import { ensureClient, loadBooking, loadTablesByIds, loadTablesForRestaurant, loadAdjacency, loadContextBookings, fetchHoldsForWindow, loadTableAssignmentsForTables, loadRestaurantTimezone, releaseHoldWithRetry, extractErrorCode, type DbClient } from "./supabase";
import { ManualSelectionInputError, type ManualSelectionOptions, type ManualValidationResult, type ManualHoldOptions, type ManualHoldResult, type ManualSelectionSummary, type ManualSelectionCheck, type ManualAssignmentConflict, type ManualAssignmentContext, type ManualAssignmentContextHold, type Table, type BookingWindow } from "./types";
import { toIsoUtc, summarizeSelection } from "./utils";

const DEFAULT_MANUAL_SLACK_BUDGET = 4;

function normalizeTableForVersion(table: Table) {
  return {
    id: table.id,
    zoneId: table.zoneId,
    capacity: table.capacity,
    mobility: table.mobility,
    active: table.active,
    category: table.category,
    seatingType: table.seatingType,
  };
}

function buildTableVersion(tables: Table[]) {
  const payload = tables
    .map(normalizeTableForVersion)
    .sort((a, b) => a.id.localeCompare(b.id));
  return computePayloadChecksum(payload);
}

function buildAdjacencyVersion(adjacency: Map<string, Set<string>>) {
  const edges = Array.from(adjacency.entries())
    .map(([id, neighbors]) => ({
      id,
      neighbors: Array.from(neighbors).sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return computePayloadChecksum(edges);
}

function buildFlagsVersion(flags: Record<string, unknown>) {
  return computePayloadChecksum(flags);
}

function buildWindowVersion(window: BookingWindow) {
  return computePayloadChecksum({
    startAt: toIsoUtc(window.block.start),
    endAt: toIsoUtc(window.block.end),
  });
}

function buildHoldsVersion(holds: ManualAssignmentContextHold[]) {
  const payload = holds
    .map((h) => ({
      id: h.id,
      tableIds: [...h.tableIds].sort(),
      startAt: h.startAt,
      endAt: h.endAt,
      expiresAt: h.expiresAt,
      bookingId: h.bookingId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return computePayloadChecksum(payload);
}

function buildAssignmentsVersion(assignments: string[]) {
  return computePayloadChecksum(assignments.slice().sort());
}

function resolveManualSlackBudget(): number {
  const override = getManualAssignmentMaxSlack();
  if (typeof override === "number") {
    return override;
  }
  const selectorConfig = getSelectorScoringConfig();
  return Math.max(0, selectorConfig.maxOverage ?? DEFAULT_MANUAL_SLACK_BUDGET);
}

function buildManualChecks(params: {
  summary: ManualSelectionSummary;
  tables: Table[];
  requireAdjacency: boolean;
  adjacency: Map<string, Set<string>>;
  conflicts: ManualAssignmentConflict[];
  holdConflicts: HoldConflictInfo[];
  slackBudget: number;
}): ManualSelectionCheck[] {
  const checks: ManualSelectionCheck[] = [];
  const { summary, tables, requireAdjacency, adjacency, conflicts, holdConflicts, slackBudget } = params;

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

  const slackOk = summary.slack <= slackBudget;
  checks.push({
    id: "slack",
    status: slackOk ? "ok" : "error",
    message: slackOk
      ? `Slack within budget (${summary.slack} <= ${slackBudget})`
      : `Selection exceeds slack budget (allowed ${slackBudget}, actual ${summary.slack})`,
    details: {
      slack: summary.slack,
      allowedSlack: slackBudget,
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
    const adjacencyMode = getAllocatorAdjacencyMode();
    const evaluation = evaluateAdjacencyGraph(
      tables.map((table) => table.id),
      adjacency,
    );
    const adjacencyOk = isAdjacencySatisfied(evaluation, adjacencyMode);
    const failureMessage =
      adjacencyMode === "pairwise"
        ? "Tables must be adjacent to every other selected table"
        : adjacencyMode === "neighbors"
          ? "Tables must share a common neighbor/hub to be merged"
          : "Tables must remain connected when adjacency enforcement is enabled";
    checks.push({
      id: "adjacency",
      status: adjacencyOk ? "ok" : "error",
      message: adjacencyOk
        ? `Tables satisfy ${summarizeAdjacencyStatus(evaluation, tables.length)} adjacency`
        : failureMessage,
      details: {
        mode: adjacencyMode,
        status: summarizeAdjacencyStatus(evaluation, tables.length),
      },
    });
  } else {
    checks.push({
      id: "adjacency",
      status: "ok",
      message: "Adjacency not required",
      details: {
        mode: requireAdjacency ? getAllocatorAdjacencyMode() : "off",
      },
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
  if (booking.assigned_zone_id && summary.zoneId && booking.assigned_zone_id !== summary.zoneId) {
    throw new ManualSelectionInputError(
      `Booking is locked to zone ${booking.assigned_zone_id}; selected zone ${summary.zoneId} is not allowed`,
      "ZONE_LOCKED",
      409,
    );
  }
  const slackBudget = resolveManualSlackBudget();
  const checks = buildManualChecks({
    summary,
    tables: selectionTables,
    requireAdjacency,
    adjacency,
    conflicts,
    holdConflicts,
    slackBudget,
  });

  const ok = checks.every((check) => check.status !== "error");

  return {
    ok,
    summary,
    checks,
    policyVersion,
    slackBudget,
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
  // =============================================
  // IMPORTANT: Adjacency snapshots are ONLY created when adjacency is required.
  // This prevents unnecessary validation errors during hold confirmation when
  // tables don't need to be adjacent (e.g., manual assignment with requireAdjacency=false).
  //
  // When requireAdjacency = true:
  //   - Capture adjacency edges and compute hash
  //   - Store in hold metadata for validation during confirmation
  //
  // When requireAdjacency = false:
  //   - Skip snapshot creation (snapshot = null)
  //   - Hold confirmation will skip adjacency validation
  // =============================================
  let adjacencySnapshot: string | null = null;
  let normalizedEdges: string[] = [];
  let adjacencyUndirected = false;
  const zoneIds = Array.from(new Set(selectionTables.map((t) => t.zoneId))).filter(Boolean) as string[];

  if (requireAdjacency) {
    const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);
    adjacencyUndirected = isAdjacencyQueryUndirected();
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
    normalizedEdges = Array.from(edgeSet).sort();
    adjacencySnapshot = computePayloadChecksum({ undirected: adjacencyUndirected, edges: normalizedEdges });
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
        snapshot: requireAdjacency ? {
          zoneIds,
          adjacency: {
            undirected: adjacencyUndirected,
            edges: normalizedEdges,
            hash: adjacencySnapshot,
          },
        } : null,
      },
      policyVersion,
      requireAdjacency, // Store the requirement for later validation
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
  const adjacency = await loadAdjacency(
    booking.restaurant_id,
    tables.map((table) => table.id),
    supabase,
  );
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
  const policyVersion = hashPolicyVersion(policy);
  const tableVersion = buildTableVersion(tables);
  const adjacencyVersion = buildAdjacencyVersion(adjacency);
  const holdsVersion = buildHoldsVersion(holds);
  const assignmentsVersion = buildAssignmentsVersion(bookingAssignments.map((row) => row.table_id));
  const flagsVersion = buildFlagsVersion(flags);
  const windowVersion = buildWindowVersion(window);
  const contextVersion = computePayloadChecksum({
    holds: holdsVersion,
    assignments: assignmentsVersion,
    flags: flagsVersion,
    window: windowVersion,
    policy: policyVersion,
    adjacency: adjacencyVersion,
    tables: tableVersion,
  });
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
    policyVersion,
    versions: {
      context: contextVersion,
      policy: policyVersion,
      window: windowVersion,
      flags: flagsVersion,
      tables: tableVersion,
      adjacency: adjacencyVersion,
      holds: holdsVersion,
      assignments: assignmentsVersion,
    },
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

/**
 * Instant table assignment - validates, creates hold, and confirms in one optimized operation
 * This is a performance-optimized single-step assignment that bypasses the manual hold workflow
 *
 * Flow:
 * 1. Validate selection (parallel data loading)
 * 2. Create + immediately confirm hold (atomic transaction)
 * 3. Return final assignment result
 *
 * @returns Hold result with immediate confirmation
 */
export async function instantTableAssignment(options: ManualHoldOptions & { assignedBy?: string | null }): Promise<ManualHoldResult & { instantAssignment: true }> {
  const {
    bookingId,
    tableIds,
    requireAdjacency: requireAdjacencyOverride,
    excludeHoldId,
    holdTtlSeconds = DEFAULT_HOLD_TTL_SECONDS,
    holdExpiresAt,
    createdBy,
    client,
    assignedBy,
  } = options;

  const supabase = ensureClient(client);

  // === STEP 1: Load booking first, then selection tables ===
  const booking = await loadBooking(bookingId, supabase);
  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);

  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("One or more selected tables were not found", "TABLE_LOOKUP_FAILED");
  }

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
      throw new ManualSelectionInputError(error.message, "SERVICE_OVERRUN", 422);
    }
    throw error;
  }

  // === STEP 2: Run validation checks in PARALLEL ===
  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
  const summary = summarizeSelection(selectionTables, booking.party_size);

  if (booking.assigned_zone_id && summary.zoneId && booking.assigned_zone_id !== summary.zoneId) {
    throw new ManualSelectionInputError(
      `Booking is locked to zone ${booking.assigned_zone_id}; selected zone ${summary.zoneId} is not allowed`,
      "ZONE_LOCKED",
      409,
    );
  }

  // Load adjacency, context, and holds in PARALLEL
  const [adjacency, contextBookings, activeHolds] = await Promise.all([
    requireAdjacency ? loadAdjacency(booking.restaurant_id, tableIds, supabase) : Promise.resolve(new Map<string, Set<string>>()),
    loadContextBookings(
      booking.restaurant_id,
      booking.booking_date ?? null,
      supabase,
      {
        startIso: toIsoUtc(window.block.start),
        endIso: toIsoUtc(window.block.end),
      },
    ),
    fetchHoldsForWindow(booking.restaurant_id, window, supabase),
  ]);

  // Build busy maps and extract conflicts
  const busyMaps = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds: activeHolds,
    excludeHoldId,
    policy,
    targetWindow: window,
  });
  const conflicts = extractConflictsForTables(busyMaps, tableIds, window);

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

  const slackBudget = resolveManualSlackBudget();
  const checks = buildManualChecks({
    summary,
    tables: selectionTables,
    requireAdjacency,
    adjacency,
    conflicts,
    holdConflicts,
    slackBudget,
  });

  const hasBlockingErrors = checks.some((check) => check.status === "error");
  if (hasBlockingErrors) {
    throw new ManualSelectionInputError(
      "Selection validation failed. Please resolve errors and try again.",
      "VALIDATION_FAILED",
      400,
    );
  }

  // === STEP 3: Create hold with metadata (optimized - no separate validation call) ===
  const startAtIso = toIsoUtc(window.block.start);
  const endAtIso = toIsoUtc(window.block.end);
  const expiresAt =
    holdExpiresAt ??
    toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })) ??
    toIsoUtc(window.block.start.plus({ minutes: 2 }));

  const zoneIdValue = summary.zoneId ?? selectionTables[0]?.zoneId;
  if (!zoneIdValue) {
    throw new ManualSelectionInputError("Unable to determine zone for selected tables", "ZONE_REQUIRED");
  }

  // Compute adjacency snapshot only if required
  let adjacencySnapshot: string | null = null;
  let normalizedEdges: string[] = [];
  let adjacencyUndirected = false;
  const zoneIds = Array.from(new Set(selectionTables.map((t) => t.zoneId))).filter(Boolean) as string[];

  if (requireAdjacency) {
    adjacencyUndirected = isAdjacencyQueryUndirected();
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
    normalizedEdges = Array.from(edgeSet).sort();
    adjacencySnapshot = computePayloadChecksum({ undirected: adjacencyUndirected, edges: normalizedEdges });
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
        summary: summary,
        snapshot: requireAdjacency ? {
          zoneIds,
          adjacency: {
            undirected: adjacencyUndirected,
            edges: normalizedEdges,
            hash: adjacencySnapshot,
          },
        } : null,
      },
      policyVersion,
      requireAdjacency,
      instantAssignment: true, // Flag to indicate this was an instant assignment
      assignedBy,
    },
    client: supabase,
  };

  const hold = await createTableHold(holdPayload);

  // Release old hold if specified (don't wait for it)
  if (excludeHoldId) {
    releaseHoldWithRetry({ holdId: excludeHoldId, client: supabase }).catch((error) => {
      console.warn("[capacity][manual][instant] failed to release replaced hold", {
        bookingId,
        newHoldId: hold.id,
        previousHoldId: excludeHoldId,
        error,
      });
    });
  }

  // Return hold result with instant assignment flag
  return {
    hold,
    validation: {
      ok: true,
      summary,
      checks,
      policyVersion,
      slackBudget,
    },
    instantAssignment: true,
  };
}
