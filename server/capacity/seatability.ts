import { getVenuePolicy, getSelectorScoringConfig } from "@/server/capacity/policy";
import { buildScoredTablePlans } from "@/server/capacity/selector";
import { buildBusyMaps, filterAvailableTables, resolveRequireAdjacency, type TableFilterDiagnostics, type TimeFilterStats } from "@/server/capacity/table-assignment/availability";
import { computeBookingWindowWithFallback } from "@/server/capacity/table-assignment/booking-window";
import { ensureClient, loadActiveHoldsForDate, loadAdjacency, loadContextBookings, loadRestaurantTimezone, loadTablesForRestaurant, type DbClient } from "@/server/capacity/table-assignment/supabase";
import { getAllocatorKMax, getSelectorPlannerLimits, isCombinationPlannerEnabled, isHoldsEnabled, isPlannerTimePruningEnabled } from "@/server/feature-flags";
import { getRestaurantTurnBands } from "@/server/restaurants/turnBands";

type SeatabilityCheckParams = {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  bookingOption?: string | null;
};

export type SeatabilityCheckResult = {
  seatable: boolean;
  reason?: string;
  plannerReason?: string;
  metadata: {
    usedFallback: boolean;
    fallbackService: string | null;
    totalTables: number;
    filteredTables: number;
    generatedPlans: number;
    relaxedMinPartySize: boolean;
    capacityOverflowFallback: boolean;
    filterDiagnostics?: TableFilterDiagnostics | null;
    timePruning?: TimeFilterStats | null;
  };
};

function buildSuccessResult(params: SeatabilityCheckResult["metadata"]): SeatabilityCheckResult {
  return {
    seatable: true,
    metadata: params,
  };
}

function computeCapacity(tables: Array<{ capacity: number | null | undefined }>): number {
  return tables.reduce((sum, table) => sum + Math.max(table.capacity ?? 0, 0), 0);
}

export async function checkRequestSeatability(
  params: SeatabilityCheckParams,
  client?: DbClient,
): Promise<SeatabilityCheckResult> {
  const supabase = ensureClient(client);
  const [restaurantTimezone, turnBandsByOption, tables] = await Promise.all([
    loadRestaurantTimezone(params.restaurantId, supabase).catch(() => null),
    getRestaurantTurnBands(params.restaurantId, supabase).catch(() => ({})),
    loadTablesForRestaurant(params.restaurantId, supabase),
  ]);

  if (tables.length === 0) {
    return buildSuccessResult({
      usedFallback: false,
      fallbackService: null,
      totalTables: 0,
      filteredTables: 0,
      generatedPlans: 0,
      relaxedMinPartySize: false,
      capacityOverflowFallback: false,
    });
  }

  const policy = getVenuePolicy({
    timezone: restaurantTimezone ?? undefined,
    turnBandsByOption,
  });

  const { window, usedFallback, fallbackService } = computeBookingWindowWithFallback({
    bookingDate: params.date,
    startTime: params.time,
    partySize: params.partySize,
    bookingOption: params.bookingOption ?? null,
    policy,
    serviceHint:
      params.bookingOption === "lunch" || params.bookingOption === "dinner"
        ? params.bookingOption
        : null,
  });

  const [adjacency, contextBookings, holdsForDay] = await Promise.all([
    loadAdjacency(
      params.restaurantId,
      tables.map((table) => table.id),
      supabase,
    ),
    loadContextBookings(
      params.restaurantId,
      params.date,
      supabase,
      {
        startIso: window.block.start.toUTC().toISO() ?? "",
        endIso: window.block.end.toUTC().toISO() ?? "",
      },
    ),
    isHoldsEnabled()
      ? loadActiveHoldsForDate(params.restaurantId, params.date, policy, supabase).catch(() => [])
      : Promise.resolve([]),
  ]);

  const totalVenueCapacity = computeCapacity(tables);
  if (params.partySize > totalVenueCapacity) {
    return {
      seatable: false,
      reason: "Insufficient global capacity",
      plannerReason: "Insufficient global capacity",
      metadata: {
        usedFallback,
        fallbackService,
        totalTables: tables.length,
        filteredTables: 0,
        generatedPlans: 0,
        relaxedMinPartySize: false,
        capacityOverflowFallback: false,
      },
    };
  }

  const timePruningEnabled = isPlannerTimePruningEnabled();
  let timePruningStats: TimeFilterStats | null = null;
  const busyForPlanner = timePruningEnabled
    ? buildBusyMaps({
        targetBookingId: "__availability_precheck__",
        bookings: contextBookings,
        holds: holdsForDay,
        policy,
        targetWindow: window,
      })
    : undefined;

  const combinationEnabled = isCombinationPlannerEnabled();
  let filterDiagnostics: TableFilterDiagnostics | null = null;
  const filterOptions = (allowMinPartySizeViolation: boolean) => ({
    allowInsufficientCapacity: true,
    allowMaxPartySizeViolation: combinationEnabled,
    allowMinPartySizeViolation,
    captureDiagnostics: (captured: TableFilterDiagnostics) => {
      filterDiagnostics = captured;
    },
    timeFilter:
      busyForPlanner && timePruningEnabled
        ? {
            busy: busyForPlanner,
            mode: "strict" as const,
            captureStats: (stats: TimeFilterStats) => {
              timePruningStats = stats;
            },
          }
        : undefined,
  });

  let filtered = filterAvailableTables(
    tables,
    params.partySize,
    window,
    adjacency,
    undefined,
    undefined,
    filterOptions(false),
  );
  let relaxedMinPartySize = false;
  let filteredCapacity = computeCapacity(filtered);

  if ((filtered.length === 0 || filteredCapacity < params.partySize) && params.partySize > 0) {
    filtered = filterAvailableTables(
      tables,
      params.partySize,
      window,
      adjacency,
      undefined,
      undefined,
      filterOptions(true),
    );
    filteredCapacity = computeCapacity(filtered);
    relaxedMinPartySize = filtered.length > 0 && filteredCapacity >= params.partySize;
  }

  if (filtered.length === 0) {
    return {
      seatable: false,
      reason: "No tables available for requested window",
      plannerReason: "No tables available for requested window",
      metadata: {
        usedFallback,
        fallbackService,
        totalTables: tables.length,
        filteredTables: 0,
        generatedPlans: 0,
        relaxedMinPartySize,
        capacityOverflowFallback: false,
        filterDiagnostics,
        timePruning: timePruningStats,
      },
    };
  }

  if (filteredCapacity < params.partySize) {
    return {
      seatable: false,
      reason: "Insufficient filtered capacity",
      plannerReason: "Insufficient filtered capacity",
      metadata: {
        usedFallback,
        fallbackService,
        totalTables: tables.length,
        filteredTables: filtered.length,
        generatedPlans: 0,
        relaxedMinPartySize,
        capacityOverflowFallback: false,
        filterDiagnostics,
        timePruning: timePruningStats,
      },
    };
  }

  const selectorLimits = getSelectorPlannerLimits();
  const scoringConfig = getSelectorScoringConfig({ restaurantId: params.restaurantId });
  const runPlanner = (allowCapacityOverflow: boolean) =>
    buildScoredTablePlans({
      tables: filtered,
      partySize: params.partySize,
      adjacency,
      config: scoringConfig,
      enableCombinations: combinationEnabled,
      kMax: getAllocatorKMax(),
      maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
      maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
      enumerationTimeoutMs: selectorLimits.enumerationTimeoutMs,
      requireAdjacency: resolveRequireAdjacency(params.partySize),
      allowCapacityOverflow,
      allowMinPartySizeViolation: relaxedMinPartySize,
    });

  let plans = runPlanner(false);
  let capacityOverflowFallback = false;

  if (plans.plans.length === 0) {
    const overflowPlans = runPlanner(true);
    if (overflowPlans.plans.length > 0) {
      plans = overflowPlans;
      capacityOverflowFallback = true;
    }
  }

  return {
    seatable: plans.plans.length > 0,
    reason: plans.plans.length > 0 ? undefined : plans.fallbackReason ?? "No suitable tables available",
    plannerReason: plans.plans.length > 0 ? undefined : plans.fallbackReason ?? "No suitable tables available",
    metadata: {
      usedFallback,
      fallbackService,
      totalTables: tables.length,
      filteredTables: filtered.length,
      generatedPlans: plans.plans.length,
      relaxedMinPartySize,
      capacityOverflowFallback,
      filterDiagnostics,
      timePruning: timePruningStats,
    },
  };
}
