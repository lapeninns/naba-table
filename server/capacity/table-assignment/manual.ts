import { DateTime } from 'luxon';

import { createTableHold } from '@/server/capacity/holds';
import {
  isHoldsEnabled,
  isHoldStrictConflictsEnabled,
  isAllocatorAdjacencyRequired,
  isAdjacencyQueryUndirected,
} from '@/server/runtime-policy';

import { resolveRequireAdjacency } from './availability';
import { DEFAULT_HOLD_TTL_SECONDS } from './constants';
import { buildManualAssignmentContextVersions } from './context-version';
import { loadManualBookingContext } from './manual-booking-context';
import { buildManualChecks, resolveManualSlackBudget } from './manual-checks';
import {
  buildManualAssignmentConflicts,
  buildManualWindowQuery,
  findManualHoldConflicts,
  loadManualValidationConflictContext,
} from './manual-conflict-context';
import { hydrateManualAssignmentContextHolds } from './manual-context-holds';
import { buildManualTableHoldPayload } from './manual-hold-payload';
import {
  assertBookingZoneAllowsManualSelection,
  assertManualSelectionTablesAvailable,
  assertManualTableIds,
  assertManualTablesLoaded,
  resolveManualSelectionZoneId,
} from './manual-selection-preconditions';
import {
  acquireManualSoftHolds,
  releaseManualSoftHolds,
  releaseManualSoftHoldsQuietly,
  verifyManualSoftHoldOwnership,
  type SoftHoldAcquisitionResult,
} from './manual-soft-holds';
import {
  ensureClient,
  loadTablesByIds,
  loadTablesForRestaurant,
  loadAdjacency,
  loadContextBookings,
  fetchHoldsForWindow,
  loadTableAssignmentsForTables,
  releaseHoldWithRetry,
  extractErrorCode,
  type DbClient,
} from './supabase';
import {
  ManualSelectionInputError,
  type ManualSelectionOptions,
  type ManualValidationResult,
  type ManualHoldOptions,
  type ManualHoldResult,
  type ManualAssignmentContext,
  type ManualAssignmentContextHold,
} from './types';
import { toIsoUtc, summarizeSelection } from './utils';

export async function evaluateManualSelection(
  options: ManualSelectionOptions,
): Promise<ManualValidationResult> {
  const {
    bookingId,
    tableIds,
    requireAdjacency: requireAdjacencyOverride,
    excludeHoldId = null,
    client,
    skipSoftHolds = false,
  } = options;

  assertManualTableIds(tableIds);

  const supabase = ensureClient(client);
  const { booking, policy, policyVersion, window } = await loadManualBookingContext({
    bookingId,
    client: supabase,
  });

  // =========================================================================
  // SOFT-HOLD ACQUISITION (always enabled)
  // =========================================================================
  // To prevent race conditions, acquire soft-holds for the selected tables
  // before running validation. This ensures that if two operators select
  // the same table simultaneously, only one will succeed.
  //
  // The soft-hold:
  // - Has a short TTL (10 seconds)
  // - Is released automatically if validation fails or times out
  // - Is converted to a real hold during createManualHold()
  // =========================================================================
  let softHoldResult: SoftHoldAcquisitionResult | null = null;

  if (!skipSoftHolds) {
    softHoldResult = await acquireManualSoftHolds({
      tableIds,
      window,
      restaurantId: booking.restaurant_id,
      bookingId,
      client: supabase,
    });
  }

  try {
    const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
    assertManualTablesLoaded({
      loadedCount: selectionTables.length,
      message: 'One or more selected tables were not found',
      requestedCount: tableIds.length,
    });

    const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);
    const { conflicts, holdConflicts } = await loadManualValidationConflictContext({
      bookingDate: booking.booking_date ?? null,
      bookingId,
      client: supabase,
      excludeHoldId,
      holdsEnabled: isHoldsEnabled(),
      policy,
      restaurantId: booking.restaurant_id,
      tableIds,
      window,
    });

    const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
    const summary = summarizeSelection(selectionTables, booking.party_size);
    assertBookingZoneAllowsManualSelection({
      assignedZoneId: booking.assigned_zone_id,
      summary,
    });

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

    const ok = checks.every((check) => check.status !== 'error');

    // If validation fails, release soft-holds
    if (!ok && softHoldResult) {
      await releaseManualSoftHoldsQuietly({
        sessionToken: softHoldResult.sessionToken,
        client: supabase,
      });
      softHoldResult = null;
    }

    return {
      ok,
      summary,
      checks,
      policyVersion,
      slackBudget,
      // Include soft-hold info in result for use by createManualHold
      ...(softHoldResult && ok
        ? {
            softHoldSessionToken: softHoldResult.sessionToken,
            softHoldExpiresAt: softHoldResult.expiresAt,
          }
        : {}),
    };
  } catch (error) {
    // If anything throws after acquisition, release soft-holds to avoid leaking locks
    if (softHoldResult) {
      await releaseManualSoftHoldsQuietly({
        sessionToken: softHoldResult.sessionToken,
        client: supabase,
      });
    }
    throw error;
  }
}

export async function createManualHold(options: ManualHoldOptions): Promise<ManualHoldResult> {
  const {
    bookingId,
    tableIds,
    createdBy,
    holdTtlSeconds = DEFAULT_HOLD_TTL_SECONDS,
    requireAdjacency,
    excludeHoldId,
    client,
    softHoldSessionToken: providedSessionToken,
  } = options;
  const supabase = ensureClient(client);

  // =========================================================================
  // SOFT-HOLD HANDLING (always enabled)
  // =========================================================================
  // 1. If a session token is provided, verify ownership before proceeding
  // 2. Skip soft-hold acquisition during evaluation (we already have them)
  // 3. Release soft-holds after successful hold creation
  //
  // This prevents the race condition where two operators can select the same
  // table simultaneously.
  // =========================================================================

  const sessionToken = providedSessionToken;

  // If a session token is provided, verify ownership
  if (sessionToken) {
    try {
      const { window } = await loadManualBookingContext({
        bookingId,
        client: supabase,
      });

      await verifyManualSoftHoldOwnership({
        sessionToken,
        tableIds,
        window,
        client: supabase,
      });
    } catch (error) {
      // Release soft-holds on any failure during ownership verification
      // This prevents tables from being locked until TTL expires
      await releaseManualSoftHoldsQuietly({ sessionToken, client: supabase });
      throw error;
    }
  }

  // Run evaluation, skipping soft-hold acquisition if we already have a valid session
  const validation = await evaluateManualSelection({
    bookingId,
    tableIds,
    requireAdjacency,
    excludeHoldId,
    client: supabase,
    skipSoftHolds: !!sessionToken, // Skip if we already verified ownership
  });

  if (!validation.ok || !validation.summary) {
    // Release soft-holds on validation failure
    if (sessionToken) {
      await releaseManualSoftHoldsQuietly({ sessionToken, client: supabase });
    }
    return {
      hold: null,
      validation,
    };
  }

  // Use session token from validation result if we didn't have one
  const effectiveSessionToken = sessionToken || validation.softHoldSessionToken;

  // Helper to release soft-holds on error - prevents leaking locks on failures
  const releaseSoftHoldsOnError = async () => {
    if (effectiveSessionToken) {
      await releaseManualSoftHoldsQuietly({
        sessionToken: effectiveSessionToken,
        client: supabase,
      });
    }
  };

  let booking: Awaited<ReturnType<typeof loadManualBookingContext>>['booking'];
  let policyVersion: string;
  let window: Awaited<ReturnType<typeof loadManualBookingContext>>['window'];
  let selectionTables: Awaited<ReturnType<typeof loadTablesByIds>>;
  let zoneIdValue: string;

  try {
    const manualContext = await loadManualBookingContext({
      bookingId,
      client: supabase,
    });
    booking = manualContext.booking;
    window = manualContext.window;
    policyVersion =
      typeof (validation as { policyVersion?: string }).policyVersion === 'string'
        ? (validation as { policyVersion?: string }).policyVersion!
        : manualContext.policyVersion;

    selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
    assertManualTablesLoaded({
      loadedCount: selectionTables.length,
      message: 'Selected tables could not be loaded',
      requestedCount: tableIds.length,
    });

    zoneIdValue = resolveManualSelectionZoneId({
      summary: validation.summary,
      tables: selectionTables,
    });
  } catch (error) {
    // Release soft-holds on any failure before hold creation
    // This prevents tables from being locked until TTL expires
    await releaseSoftHoldsOnError();
    throw error;
  }

  const startAtIso = toIsoUtc(window.block.start);
  const endAtIso = toIsoUtc(window.block.end);

  const expiresAt =
    options.holdExpiresAt ??
    toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })) ??
    toIsoUtc(window.block.start.plus({ minutes: 2 }));

  const holdPayload = buildManualTableHoldPayload({
    adjacency: requireAdjacency
      ? await loadAdjacency(booking.restaurant_id, tableIds, supabase)
      : new Map(),
    adjacencyUndirected: requireAdjacency === true ? isAdjacencyQueryUndirected() : false,
    bookingId,
    restaurantId: booking.restaurant_id,
    zoneId: zoneIdValue,
    tableIds,
    startAt: startAtIso,
    endAt: endAtIso,
    expiresAt,
    createdBy,
    policyVersion,
    requireAdjacency,
    summary: validation.summary,
    tables: selectionTables,
    client: supabase,
  });

  const hold = await createTableHold(holdPayload);

  // Release soft-holds after successful hold creation
  // The real hold now protects the tables, so soft-holds are no longer needed
  if (effectiveSessionToken) {
    await releaseManualSoftHolds({
      sessionToken: effectiveSessionToken,
      client: supabase,
      onError: (error) => {
        console.warn('[capacity][manual] Failed to release soft-holds after hold creation', {
          bookingId,
          holdId: hold.id,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
  }

  if (excludeHoldId) {
    try {
      await releaseHoldWithRetry({ holdId: excludeHoldId, client: supabase });
    } catch (error) {
      console.warn('[capacity][manual][holds] failed to release replaced hold', {
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
  const { booking, policy, policyVersion, window } = await loadManualBookingContext({
    bookingId,
    client: supabase,
  });

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
    buildManualWindowQuery(window),
  );

  let holds: ManualAssignmentContextHold[] = [];
  if (isHoldsEnabled()) {
    try {
      const rawHolds = await fetchHoldsForWindow(booking.restaurant_id, window, supabase);
      holds = await hydrateManualAssignmentContextHolds({
        client: supabase,
        holds: rawHolds,
      });
    } catch (error: unknown) {
      const code = extractErrorCode(error);
      if (code === '42P01') {
        console.warn(
          '[capacity][manual][context] holds table unavailable; skipping hold hydration',
          {
            bookingId,
          },
        );
      } else {
        console.warn('[capacity][manual][context] failed to list holds', { bookingId, error });
      }
      holds = [];
    }
  }

  const bookingAssignments = await loadTableAssignmentsForTables(
    bookingId,
    tables.map((table) => table.id),
    supabase,
  );

  const conflicts = buildManualAssignmentConflicts({
    bookings: contextBookings,
    holds,
    policy,
    tableIds: tables.map((table) => table.id),
    targetBookingId: bookingId,
    window,
  });

  const activeHold = holds.find((hold) => hold.bookingId === bookingId) ?? null;

  // Compute context version from holds + assignments + flags + window
  const flags = {
    holdsStrictConflicts: isHoldStrictConflictsEnabled(),
    adjacencyRequired: isAllocatorAdjacencyRequired(),
    adjacencyUndirected: isAdjacencyQueryUndirected(),
  };
  const versions = buildManualAssignmentContextVersions({
    adjacency,
    assignments: bookingAssignments.map((row) => row.table_id),
    flags,
    holds,
    policyVersion,
    tables,
    window,
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
    contextVersion: versions.context,
    policyVersion,
    versions,
    serverNow,
  };
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
export async function instantTableAssignment(
  options: ManualHoldOptions & { assignedBy?: string | null },
): Promise<ManualHoldResult & { instantAssignment: true }> {
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
  const { booking, policy, policyVersion, window } = await loadManualBookingContext({
    bookingId,
    client: supabase,
  });
  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);

  assertManualTablesLoaded({
    loadedCount: selectionTables.length,
    message: 'One or more selected tables were not found',
    requestedCount: tableIds.length,
  });

  assertManualSelectionTablesAvailable(selectionTables);

  // Acquire soft-holds before validation to prevent concurrent selection races.
  let softHoldResult: SoftHoldAcquisitionResult | null = null;
  softHoldResult = await acquireManualSoftHolds({
    tableIds,
    window,
    restaurantId: booking.restaurant_id,
    bookingId,
    client: supabase,
  });

  try {
    // === STEP 2: Run validation checks in PARALLEL ===
    const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
    const summary = summarizeSelection(selectionTables, booking.party_size);

    assertBookingZoneAllowsManualSelection({
      assignedZoneId: booking.assigned_zone_id,
      summary,
    });

    // Load adjacency, context, and holds in PARALLEL
    const [adjacency, contextBookings, activeHolds] = await Promise.all([
      requireAdjacency
        ? loadAdjacency(booking.restaurant_id, tableIds, supabase)
        : Promise.resolve(new Map<string, Set<string>>()),
      loadContextBookings(
        booking.restaurant_id,
        booking.booking_date ?? null,
        supabase,
        buildManualWindowQuery(window),
      ),
      fetchHoldsForWindow(booking.restaurant_id, window, supabase),
    ]);

    const conflicts = buildManualAssignmentConflicts({
      bookings: contextBookings,
      holds: activeHolds,
      excludeHoldId,
      policy,
      tableIds,
      targetBookingId: bookingId,
      window,
    });
    const holdConflicts = await findManualHoldConflicts({
      client: supabase,
      excludeHoldId,
      restaurantId: booking.restaurant_id,
      tableIds,
      window,
    });

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

    const hasBlockingErrors = checks.some((check) => check.status === 'error');
    if (hasBlockingErrors) {
      throw new ManualSelectionInputError(
        'Selection validation failed. Please resolve errors and try again.',
        'VALIDATION_FAILED',
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

    const zoneIdValue = resolveManualSelectionZoneId({
      summary,
      tables: selectionTables,
    });

    const holdPayload = buildManualTableHoldPayload({
      adjacency,
      adjacencyUndirected: requireAdjacency === true ? isAdjacencyQueryUndirected() : false,
      assignedBy,
      bookingId,
      restaurantId: booking.restaurant_id,
      zoneId: zoneIdValue,
      tableIds,
      startAt: startAtIso,
      endAt: endAtIso,
      expiresAt,
      createdBy,
      instantAssignment: true,
      policyVersion,
      requireAdjacency,
      summary,
      tables: selectionTables,
      client: supabase,
    });

    const hold = await createTableHold(holdPayload);

    // Release soft-holds after successful hold creation.
    // The real hold now protects the tables.
    if (softHoldResult) {
      await releaseManualSoftHolds({
        sessionToken: softHoldResult.sessionToken,
        client: supabase,
        onError: (releaseError) => {
          console.warn('[capacity][manual][instant] Failed to release soft-holds', {
            bookingId,
            holdId: hold.id,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        },
      });
    }

    // Release old hold if specified (don't wait for it)
    if (excludeHoldId) {
      releaseHoldWithRetry({ holdId: excludeHoldId, client: supabase }).catch((error) => {
        console.warn('[capacity][manual][instant] failed to release replaced hold', {
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
  } catch (error) {
    // Release soft-holds on any failure to avoid leaking locks
    if (softHoldResult) {
      await releaseManualSoftHoldsQuietly({
        sessionToken: softHoldResult.sessionToken,
        client: supabase,
      });
    }
    throw error;
  }
}
