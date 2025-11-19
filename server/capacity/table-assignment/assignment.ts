import { AssignTablesRpcError, HoldNotFoundError } from "@/server/capacity/holds";
import { getVenuePolicy } from "@/server/capacity/policy";
import { emitRpcConflict } from "@/server/capacity/telemetry";
import { isAllocatorV2Enabled, isPolicyRequoteEnabled, isManualAssignmentSnapshotValidationEnabled } from "@/server/feature-flags";
import { recordObservabilityEvent } from "@/server/observability";

import { resolveRequireAdjacency } from "./availability";
import { computeBookingWindowWithFallback } from "./booking-window";
import { DEFAULT_HOLD_TTL_SECONDS, TABLE_RESOURCE_TYPE } from "./constants";
import { quoteTablesForBooking } from "./quote";
import {
  ensureClient,
  applyAbortSignal,
  findMissingHoldMetadataFields,
  loadBooking,
  loadTablesByIds,
  loadAdjacency,
  loadRestaurantTimezone,
  releaseHoldWithRetry,
  loadTableAssignmentsForTables,
  type DbClient,
  type TableHoldRow,
  type BookingRow,
} from "./supabase";
import {
  AssignmentOrchestrator,
  AssignmentConflictError,
  AssignmentRepositoryError,
  AssignmentValidationError,
  SupabaseAssignmentRepository,
  createPlanSignature,
  createDeterministicIdempotencyKey,
  computePayloadChecksum,
  hashPolicyVersion,
  normalizeTableIds,
} from "../v2";
import {
  ManualSelectionInputError,
  PolicyDriftError,
  type PolicyDriftDetails,
  type PolicyDriftKind,
  type TableAssignmentMember,
} from "./types";
import { serializeDetails, toIsoUtc, normalizeIsoString } from "./utils";

import type { Tables, Json } from "@/types/supabase";

let confirmHoldAssignmentRpcAvailable: boolean | undefined;
const ASSIGNMENT_REFRESH_ATTEMPTS = 2;
const ASSIGNMENT_REFRESH_DELAY_MS = 15;

type ConfirmHoldTransition = {
  targetStatus: Tables<"bookings">["status"];
  historyReason: string;
  historyMetadata?: Json;
  historyChangedBy?: string | null;
};

type ConfirmHoldAssignmentOptions = {
  holdId: string;
  bookingId: string;
  idempotencyKey?: string;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  client?: DbClient;
  signal?: AbortSignal;
  transition?: ConfirmHoldTransition;
};

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
  signal?: AbortSignal;
};

function isSchemaCacheMissError(error: AssignTablesRpcError): boolean {
  const code = (error.code ?? "").toUpperCase();
  if (["PGRST202", "PGRST204", "42883", "42P01"].includes(code)) {
    return true;
  }
  const text = `${error.message ?? ""} ${typeof error.details === "string" ? error.details : ""}`.toLowerCase();
  if (text.includes("schema cache")) {
    return true;
  }
  if (text.includes("does not exist") && (text.includes("function") || text.includes("relation"))) {
    return true;
  }
  return false;
}

type LegacyConfirmContext = {
  supabase: DbClient;
  booking: BookingRow;
  holdRow: TableHoldRow;
  normalizedTableIds: string[];
  startIso: string;
  endIso: string;
  assignedBy: string | null;
  idempotencyKey: string;
  requireAdjacency: boolean;
  holdId: string;
  transition?: ConfirmHoldTransition;
};

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

async function synchronizeAssignments(params: AssignmentSyncParams): Promise<TableAssignmentMember[]> {
  const {
    supabase,
    booking,
    tableIds,
    idempotencyKey,
    assignments,
    startIso,
    endIso,
    actorId,
    mergeGroupId,
    holdContext,
    signal,
  } = params;
  const uniqueTableIds = Array.from(new Set(tableIds));
  const loadAssignments = () => loadTableAssignmentsForTables(booking.id, uniqueTableIds, supabase);

  // Prune allocations that belong to this booking but no longer match the requested tables to prevent
  // stale exclusion conflicts (e.g., after reschedules/reassignments).
  try {
    const { data: existingAllocations, error: allocationLoadError } = await supabase
      .from("allocations")
      .select("id, resource_id")
      .eq("booking_id", booking.id)
      .eq("resource_type", TABLE_RESOURCE_TYPE);

    if (!allocationLoadError && existingAllocations?.length) {
      const staleAllocationIds = existingAllocations
        .filter((allocation) => !uniqueTableIds.includes(allocation.resource_id))
        .map((allocation) => allocation.id);

      if (staleAllocationIds.length > 0) {
        await supabase.from("allocations").delete().in("id", staleAllocationIds);
      }
    }
  } catch (error) {
    console.warn("[capacity.assignments] prune stale allocations failed", {
      bookingId: booking.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let assignmentRows = await loadAssignments();
  const windowRange = `[${startIso},${endIso})`;

  const needsUpdate = assignments.some((assignment) => {
    const normalizedStart = normalizeIsoString(assignment.startAt ?? null);
    const normalizedEnd = normalizeIsoString(assignment.endAt ?? null);
    return normalizedStart !== startIso || normalizedEnd !== endIso;
  });

  if (needsUpdate) {
    let syncedViaRpc = false;
    const payloadChecksum = computePayloadChecksum({
      bookingId: booking.id,
      tableIds: uniqueTableIds,
      startAt: startIso,
      endAt: endIso,
      actorId,
      holdId: holdContext?.holdId ?? null,
    }) as unknown as string;

    try {
      const rpcCall = applyAbortSignal(
        supabase.rpc("sync_confirmed_assignment_windows", {
          p_booking_id: booking.id,
          p_table_ids: uniqueTableIds,
          p_window_start: startIso,
          p_window_end: endIso,
          p_actor_id: actorId ?? undefined,
          p_hold_id: holdContext?.holdId ?? undefined,
          p_merge_group_id: mergeGroupId ?? undefined,
          p_idempotency_key: idempotencyKey ?? undefined,
          p_payload_checksum: idempotencyKey ? payloadChecksum : undefined,
        }),
        signal,
      );

      const { data: syncRows, error: syncError } = await rpcCall;
      if (syncError) {
        throw syncError;
      }
      if (Array.isArray(syncRows) && syncRows.length > 0) {
        assignmentRows = syncRows as typeof assignmentRows;
        syncedViaRpc = true;
      }
    } catch (error) {
      console.warn("[capacity.confirm] sync_confirmed_assignment_windows failed", {
        bookingId: booking.id,
        holdId: holdContext?.holdId ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!syncedViaRpc) {
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
              payload_checksum: payloadChecksum,
            } as Record<string, unknown>)
            .eq("booking_id", booking.id)
            .eq("idempotency_key", idempotencyKey);
        } catch {
          // Ignore ledger updates in mocked environments.
        }
      }

      assignmentRows = await loadAssignments();
    }
  }

  const assignmentLookup = new Map<string, RawAssignmentRecord>();
  for (const assignment of assignments) {
    assignmentLookup.set(assignment.tableId, assignment);
  }

  let tableRowLookup = new Map(assignmentRows.map((row) => [row.table_id, row]));
  const missingTableIds = new Set(uniqueTableIds.filter((tableId) => !tableRowLookup.has(tableId)));

  for (let attempt = 0; attempt < ASSIGNMENT_REFRESH_ATTEMPTS && missingTableIds.size > 0; attempt += 1) {
    await sleep(ASSIGNMENT_REFRESH_DELAY_MS);
    assignmentRows = await loadAssignments();
    tableRowLookup = new Map(assignmentRows.map((row) => [row.table_id, row]));
    for (const tableId of Array.from(missingTableIds)) {
      if (tableRowLookup.has(tableId)) {
        missingTableIds.delete(tableId);
      }
    }
  }

  if (missingTableIds.size > 0) {
    console.warn("[capacity.assignments] assignment rows missing after refresh", {
      bookingId: booking.id,
      missingTableIds: Array.from(missingTableIds),
    });
  }

  const result: TableAssignmentMember[] = uniqueTableIds.map((tableId) => {
    const row = tableRowLookup.get(tableId);
    const assignment = assignmentLookup.get(tableId);
    return {
      tableId,
      assignmentId: row?.id ?? "",
      startAt: startIso,
      endAt: endIso,
      mergeGroupId: assignment?.mergeGroupId ?? mergeGroupId ?? null,
    };
  });

  if (holdContext) {
    const zoneId = holdContext.zoneId ?? "";
    const telemetryMetadata = holdContext.zoneId ? undefined : { unknownZone: true };
    try {
      const { enqueueOutboxEvent } = await import("@/server/outbox");
      await enqueueOutboxEvent({
        eventType: "capacity.hold.confirmed",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        idempotencyKey: idempotencyKey ?? null,
        dedupeKey: `${booking.id}:${holdContext.holdId}:hold.confirmed`,
        payload: {
          holdId: holdContext.holdId,
          bookingId: booking.id,
          restaurantId: booking.restaurant_id,
          zoneId,
          tableIds: result.map((assignment) => assignment.tableId),
          startAt: startIso,
          endAt: endIso,
          expiresAt: endIso,
          actorId: actorId ?? null,
          metadata: telemetryMetadata ?? null,
        },
      });
    } catch (e) {
      console.warn("[capacity.outbox] enqueue hold.confirmed failed", { bookingId: booking.id, error: e });
    }
  }

  try {
    const { enqueueOutboxEvent } = await import("@/server/outbox");
    await enqueueOutboxEvent({
      eventType: "capacity.assignment.sync",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      idempotencyKey: idempotencyKey ?? null,
      dedupeKey: `${booking.id}:${startIso}:${endIso}:${result.map((assignment) => assignment.tableId).join(",")}`,
      payload: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        tableIds: result.map((assignment) => assignment.tableId),
        startAt: startIso,
        endAt: endIso,
        mergeGroupId: mergeGroupId ?? null,
        idempotencyKey: idempotencyKey ?? null,
      },
    });
  } catch (e) {
    console.warn("[capacity.outbox] enqueue assignment.sync failed", { bookingId: booking.id, error: e });
  }

  return result;
}

async function loadCachedConfirmationResult(params: {
  supabase: DbClient;
  bookingId: string;
  holdId: string;
  idempotencyKey?: string | null;
  signal?: AbortSignal;
}): Promise<TableAssignmentMember[] | null> {
  const { supabase, bookingId, holdId, idempotencyKey, signal } = params;
  let confirmationQuery = applyAbortSignal(
    supabase
      .from("booking_confirmation_results")
      .select("idempotency_key")
      .eq("booking_id", bookingId)
      .limit(1),
    signal,
  );

  if (idempotencyKey) {
    confirmationQuery = confirmationQuery.eq("idempotency_key", idempotencyKey);
  } else {
    confirmationQuery = confirmationQuery.eq("hold_id", holdId);
  }

  const { data: confirmation, error: confirmationError } = await confirmationQuery.maybeSingle();
  if (confirmationError || !confirmation) {
    return null;
  }

  const cachedKey = confirmation.idempotency_key;
  const assignmentsQuery = applyAbortSignal(
    supabase
      .from("booking_table_assignments")
      .select("id, table_id, start_at, end_at, merge_group_id")
      .eq("booking_id", bookingId)
      .eq("idempotency_key", cachedKey),
    signal,
  );
  const { data: rows, error: assignmentsError } = await assignmentsQuery;
  if (assignmentsError || !Array.isArray(rows) || rows.length === 0) {
    console.warn("[capacity.confirm] confirmation cache missing assignments", {
      bookingId,
      holdId,
      idempotencyKey: cachedKey,
      error: assignmentsError?.message ?? assignmentsError ?? null,
    });
    return null;
  }

  return rows.map((row) => ({
    tableId: row.table_id,
    assignmentId: row.id ?? "",
    startAt: row.start_at ?? "",
    endAt: row.end_at ?? "",
    mergeGroupId: row.merge_group_id ?? null,
  }));
}

async function confirmHoldAssignmentLegacy(ctx: LegacyConfirmContext): Promise<TableAssignmentMember[]> {
  const {
    supabase,
    booking,
    holdRow,
    normalizedTableIds,
    startIso,
    endIso,
    assignedBy,
    idempotencyKey,
    requireAdjacency,
    holdId,
  } = ctx;
  const actorId = assignedBy ?? null;
  const legacyHoldRow = holdRow;

  const planSignature = createPlanSignature({
    bookingId: booking.id,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    salt: idempotencyKey ?? undefined,
  });

  const orchestrator = new AssignmentOrchestrator(new SupabaseAssignmentRepository(supabase));
  let response;
  try {
    response = await orchestrator.commitPlan(
      {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        partySize: booking.party_size,
        serviceDate: booking.booking_date ?? null,
        window: { startAt: startIso, endAt: endIso },
      },
      {
        signature: planSignature,
        tableIds: normalizedTableIds,
        startAt: startIso,
        endAt: endIso,
        metadata: { requestSource: "confirmHoldAssignmentFallback" },
      },
      {
        source: "auto",
        idempotencyKey,
        actorId,
        metadata: { requireAdjacency, fallback: true },
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

  const assignmentPayload = response.assignments.map((assignment) => ({
    tableId: assignment.tableId,
    startAt: assignment.startAt,
    endAt: assignment.endAt,
    mergeGroupId: assignment.mergeGroupId ?? response.mergeGroupId ?? null,
  }));

  const synchronized = await synchronizeAssignments({
    supabase,
    booking,
    tableIds: normalizedTableIds,
    idempotencyKey,
    assignments: assignmentPayload,
    startIso,
    endIso,
    actorId,
    mergeGroupId: response.mergeGroupId ?? null,
    holdContext: {
      holdId,
      zoneId: legacyHoldRow.zone_id ?? null,
    },
  });

  const transition = ctx.transition;
  if (transition?.targetStatus) {
    const targetStatus = transition.targetStatus;
    if (booking.status !== targetStatus) {
      const nowIso = new Date().toISOString();
      const { data: transitionRows, error: transitionError } = await supabase.rpc("apply_booking_state_transition", {
        p_booking_id: booking.id,
        p_status: targetStatus,
        p_checked_in_at: booking.checked_in_at ?? null,
        p_checked_out_at: booking.checked_out_at ?? null,
        p_updated_at: nowIso,
        p_history_from: booking.status,
        p_history_to: targetStatus,
        p_history_changed_by: transition.historyChangedBy ?? null,
        p_history_changed_at: nowIso,
        p_history_reason: transition.historyReason ?? "auto_assign_confirm",
        p_history_metadata: transition.historyMetadata ?? {},
      });

      if (transitionError) {
        throw new AssignTablesRpcError({
          message: transitionError.message ?? "Failed to transition booking status after assignment",
          code: transitionError.code ?? "BOOKING_STATUS_TRANSITION_FAILED",
          details: serializeDetails(transitionError.details ?? null),
          hint: transitionError.hint ?? null,
        });
      }

      const transitionRow = Array.isArray(transitionRows) ? transitionRows[0] : null;
      booking.status = (transitionRow?.status as Tables<"bookings">["status"] | undefined) ?? targetStatus;
      if ("checked_in_at" in booking) {
        (booking as BookingRow).checked_in_at = (transitionRow?.checked_in_at as string | null | undefined) ?? booking.checked_in_at ?? null;
      }
      if ("checked_out_at" in booking) {
        (booking as BookingRow).checked_out_at = (transitionRow?.checked_out_at as string | null | undefined) ?? booking.checked_out_at ?? null;
      }
    }
  }

  try {
    await releaseHoldWithRetry({ holdId, client: supabase });
  } catch (releaseError) {
    console.warn("[capacity.confirm][fallback] failed to release hold", {
      holdId,
      bookingId: booking.id,
      error: releaseError instanceof Error ? releaseError.message : String(releaseError),
    });
  }

  await recordObservabilityEvent({
    source: "capacity.confirm",
    eventType: "confirm_hold.rpc_fallback_succeeded",
    restaurantId: booking.restaurant_id ?? undefined,
    bookingId: booking.id,
    context: {
      holdId,
      tableCount: normalizedTableIds.length,
    },
    severity: "info",
  }).catch(() => {});

  return synchronized;
}

export async function confirmHoldAssignment(options: ConfirmHoldAssignmentOptions): Promise<TableAssignmentMember[]> {
  if (!isAllocatorV2Enabled()) {
    throw new AssignTablesRpcError({
      message: "Allocator v2 must be enabled to confirm holds",
      code: "ALLOCATOR_V2_DISABLED",
      details: null,
      hint: "Enable allocator.v2.enabled to use confirmHoldAssignment",
    });
  }

  const {
    holdId,
    bookingId,
    idempotencyKey: providedIdempotencyKey,
    requireAdjacency: requireAdjacencyOverride,
    assignedBy = null,
    client,
    signal,
    transition,
  } = options;
  const supabase = ensureClient(client);
  const actorId = assignedBy ?? null;

  const cachedAssignments = await loadCachedConfirmationResult({
    supabase,
    bookingId,
    holdId,
    idempotencyKey: providedIdempotencyKey ?? null,
    signal,
  });
  if (cachedAssignments) {
    return cachedAssignments;
  }

  const holdQuery = applyAbortSignal(
    supabase
      .from("table_holds")
      .select("id, restaurant_id, zone_id, booking_id, metadata, table_hold_members(table_id)")
      .eq("id", holdId),
    signal,
  );
  const { data: holdRow, error: holdError } = await holdQuery.maybeSingle();

  if (holdError) {
    throw new HoldNotFoundError(holdError.message ?? "Failed to load table hold");
  }

  if (!holdRow) {
    throw new HoldNotFoundError();
  }

  const missingMetadataFields = findMissingHoldMetadataFields(holdRow as TableHoldRow);
  if (missingMetadataFields.length > 0) {
    await recordObservabilityEvent({
      source: "capacity.confirm",
      eventType: "holds.metadata.invalid",
      severity: "warning",
      restaurantId: holdRow.restaurant_id ?? undefined,
      bookingId,
      context: {
        holdId,
        missingFields: missingMetadataFields,
      },
    });

    throw new AssignTablesRpcError({
      message: "Hold metadata incomplete; regenerate hold before confirming",
      code: "HOLD_METADATA_INCOMPLETE",
      details: serializeDetails({ missingFields: missingMetadataFields }),
      hint: "Re-create hold to capture latest selection snapshot.",
    });
  }

  const typedHoldRow = holdRow as TableHoldRow;
  const holdMetadata = (typedHoldRow.metadata ?? null) as
    | {
        policyVersion?: string | null;
        requireAdjacency?: boolean;
        selection?: {
          snapshot?: {
            zoneIds?: string[];
            adjacency?: { undirected?: boolean; edges?: string[]; hash?: string };
          };
        };
      }
    | null;

  const tableIds = Array.isArray(typedHoldRow.table_hold_members)
    ? (typedHoldRow.table_hold_members as Array<{ table_id: string }>).map((member) => member.table_id)
    : [];

  const holdBookingId = typedHoldRow.booking_id ?? null;
  if (holdBookingId && holdBookingId !== bookingId) {
    await emitRpcConflict({
      source: "confirm_hold_booking_mismatch",
      bookingId,
      restaurantId: holdRow.restaurant_id,
      tableIds,
      holdId,
      error: {
        code: "HOLD_BOOKING_MISMATCH",
        message: "Hold is already linked to a different booking",
        details: serializeDetails({ holdBookingId }),
        hint: null,
      },
    });

    throw new AssignTablesRpcError({
      message: "Hold is already linked to a different booking",
      code: "HOLD_BOOKING_MISMATCH",
      details: serializeDetails({ holdBookingId }),
      hint: null,
    });
  }

  if (tableIds.length === 0) {
    throw new AssignTablesRpcError({
      message: "Hold has no tables",
      code: "HOLD_EMPTY",
      details: null,
      hint: null,
    });
  }

  const booking = await loadBooking(bookingId, supabase);
  if (typedHoldRow.restaurant_id && typedHoldRow.restaurant_id !== booking.restaurant_id) {
    await recordObservabilityEvent({
      source: "capacity.confirm",
      eventType: "holds.restaurant.mismatch",
      severity: "error",
      restaurantId: booking.restaurant_id ?? undefined,
      bookingId,
      context: {
        holdId,
        holdRestaurantId: typedHoldRow.restaurant_id,
        bookingRestaurantId: booking.restaurant_id,
      },
    }).catch(() => {});

    throw new AssignTablesRpcError({
      message: "Hold belongs to a different restaurant",
      code: "HOLD_RESTAURANT_MISMATCH",
      details: serializeDetails({
        bookingRestaurantId: booking.restaurant_id,
        holdRestaurantId: typedHoldRow.restaurant_id,
      }),
      hint: "Regenerate the hold under the correct tenant before confirming.",
    });
  }
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const policyVersion = hashPolicyVersion(policy);
  const holdPolicyVersion = typeof holdMetadata?.policyVersion === "string" ? holdMetadata.policyVersion : null;
  if (holdPolicyVersion && holdPolicyVersion !== policyVersion) {
    throw new PolicyDriftError({
      message: "Policy has changed since hold was created",
      kind: "policy",
      details: {
        expectedHash: holdPolicyVersion,
        actualHash: policyVersion,
        raw: {
          expected: holdPolicyVersion,
          actual: policyVersion,
        },
      },
    });
  }
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });
  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);

  const startIso = toIsoUtc(window.block.start);
  const endIso = toIsoUtc(window.block.end);
  const normalizedTableIds = normalizeTableIds(tableIds);

  // Verify adjacency/zone snapshot freeze
  // =============================================
  // This validation ensures table adjacency relationships haven't changed between
  // hold creation and confirmation. This prevents assignment of tables that are
  // no longer adjacent or have moved zones.
  //
  // Validation only runs when ALL of the following are true:
  // 1. A snapshot was captured during hold creation (selectionSnapshot exists)
  // 2. Adjacency was required when the hold was created (wasAdjacencyRequired = true)
  // 3. Snapshot validation is enabled via feature flag (snapshotValidationEnabled = true)
  //
  // If adjacency was NOT required during hold creation (manual assignment with requireAdjacency=false),
  // the snapshot will be null and this validation is skipped entirely.
  // =============================================
  let adjacencySnapshotHash: string | null = null;
  const selectionSnapshot = holdMetadata?.selection?.snapshot ?? null;
  const wasAdjacencyRequired = Boolean(holdMetadata?.requireAdjacency);
  const snapshotValidationEnabled = isManualAssignmentSnapshotValidationEnabled();
  const shouldValidateSnapshot = selectionSnapshot && wasAdjacencyRequired && snapshotValidationEnabled;

  if (shouldValidateSnapshot) {
    const currentTables = await loadTablesByIds(booking.restaurant_id, normalizedTableIds, supabase, signal);
    const currentZoneIds = Array.from(new Set(currentTables.map((t) => t.zoneId))).filter(Boolean) as string[];
    const zonesMatch = JSON.stringify([...currentZoneIds].sort()) === JSON.stringify([...(selectionSnapshot.zoneIds ?? [])].sort());

    const currentAdjacency = await loadAdjacency(booking.restaurant_id, normalizedTableIds, supabase, signal);
    const undirected = Boolean(selectionSnapshot.adjacency?.undirected);
    const edgeSet = new Set<string>();
    for (const a of normalizedTableIds) {
      const neighbors = currentAdjacency.get(a);
      if (!neighbors) continue;
      for (const b of neighbors) {
        if (!normalizedTableIds.includes(b)) continue;
        const key = undirected ? ([a, b].sort((x, y) => x.localeCompare(y)) as [string, string]).join("->") : `${a}->${b}`;
        edgeSet.add(key);
      }
    }
    const nowEdges = Array.from(edgeSet).sort();
    const nowHash = computePayloadChecksum({ undirected, edges: nowEdges });
    adjacencySnapshotHash = nowHash;
    const edgesMatch =
      nowHash === selectionSnapshot.adjacency?.hash &&
      JSON.stringify(nowEdges) === JSON.stringify([...(selectionSnapshot.adjacency?.edges ?? [])].sort());

    if (!zonesMatch || !edgesMatch) {
      throw new PolicyDriftError({
        message: !zonesMatch
          ? "Zone assignment changed since hold was created"
          : "Adjacency definition changed since hold was created. This indicates table relationships were modified after the hold was placed.",
        kind: "adjacency",
        details: {
          zones: {
            expected: selectionSnapshot.zoneIds ?? [],
            actual: currentZoneIds,
          },
          adjacency: {
            expectedHash: selectionSnapshot.adjacency?.hash ?? null,
            actualHash: nowHash,
            expectedEdges: selectionSnapshot.adjacency?.edges ?? [],
            actualEdges: nowEdges,
          },
          raw: {
            zones: { expected: selectionSnapshot.zoneIds ?? [], actual: currentZoneIds },
            adjacency: {
              undirected,
              expectedHash: selectionSnapshot.adjacency?.hash ?? null,
              actualHash: nowHash,
              expectedEdges: selectionSnapshot.adjacency?.edges ?? [],
              actualEdges: nowEdges,
            },
            wasAdjacencyRequired,
            requireAdjacency,
            snapshotValidationEnabled,
          },
        },
      });
    }
  }
  const deterministicKey = createDeterministicIdempotencyKey({
    tenantId: booking.restaurant_id,
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    policyVersion,
  });
  // Optional: pre-check for mismatched payloads for same key (legacy-compatible)
  try {
    const ledgerLookup = applyAbortSignal(
      supabase
        .from("booking_assignment_idempotency")
        .select("idempotency_key, booking_id, table_ids, assignment_window")
        .eq("booking_id", bookingId)
        .eq("idempotency_key", deterministicKey),
      signal,
    );
    const { data: existing } = await ledgerLookup.maybeSingle();
    if (existing && typeof existing === "object") {
      const existingTyped = existing as { table_ids?: unknown };
      const sameTables = Array.isArray(existingTyped.table_ids)
        ? normalizeTableIds(existingTyped.table_ids as string[]).join(",") === normalizedTableIds.join(",")
        : true;
      if (!sameTables) {
        throw new AssignTablesRpcError({
          message: "Idempotency mismatch for the same key",
          code: "RPC_VALIDATION",
          details: serializeDetails({ reason: "IDEMPOTENCY_MISMATCH" }),
          hint: "Retry using the same payload as the original request.",
        });
      }
    }
  } catch {
    // ignore lookup errors
  }

  const effectiveIdempotencyKey = providedIdempotencyKey ?? deterministicKey;
  const fallbackContext: LegacyConfirmContext = {
    supabase,
    booking,
    holdRow: typedHoldRow,
    normalizedTableIds,
    startIso,
    endIso,
    assignedBy,
    idempotencyKey: effectiveIdempotencyKey,
    requireAdjacency,
    holdId,
    transition,
  };

  if (confirmHoldAssignmentRpcAvailable === false) {
    return confirmHoldAssignmentLegacy(fallbackContext);
  }

  const rpcArgs = {
    p_hold_id: holdId,
    p_booking_id: bookingId,
    p_idempotency_key: effectiveIdempotencyKey,
    p_require_adjacency: requireAdjacency,
    p_assigned_by: assignedBy ?? undefined,
    p_window_start: startIso,
    p_window_end: endIso,
    p_expected_policy_version: policyVersion,
    p_expected_adjacency_hash: adjacencySnapshotHash ?? undefined,
    p_target_status: transition?.targetStatus ?? undefined,
    p_history_reason: transition?.historyReason ?? "auto_assign_confirm",
    p_history_metadata: transition?.historyMetadata ?? {},
    p_history_changed_by: transition?.historyChangedBy ?? undefined,
  };

  const rpcCall = applyAbortSignal(supabase.rpc("confirm_hold_assignment_tx", rpcArgs), signal);
  const { data: rpcData, error: rpcError } = await rpcCall;

  if (rpcError) {
    const rpcFailure = new AssignTablesRpcError({
      message: rpcError.message ?? "confirm_hold_assignment_tx failed",
      code: rpcError.code ?? "RPC_EXECUTION_FAILED",
      details: serializeDetails(rpcError.details ?? null),
      hint: rpcError.hint ?? null,
    });

    if ((rpcFailure.code ?? "").toUpperCase() === "POLICY_DRIFT") {
      const parsedDetails = extractPolicyDriftDetails(rpcFailure);
      const derivedKind: PolicyDriftKind = parsedDetails.adjacency || parsedDetails.zones ? "adjacency" : "policy";
      throw new PolicyDriftError({
        message: rpcFailure.message,
        kind: derivedKind,
        details: parsedDetails,
        hint: rpcFailure.hint ?? undefined,
      });
    }

    if (isSchemaCacheMissError(rpcFailure)) {
      console.warn("[capacity.confirm] confirm_hold_assignment_tx unavailable, falling back", {
        bookingId,
        holdId,
        code: rpcFailure.code,
        message: rpcFailure.message,
      });
      confirmHoldAssignmentRpcAvailable = false;
      await recordObservabilityEvent({
        source: "capacity.confirm",
        eventType: "confirm_hold.rpc_schema_cache_miss",
        restaurantId: booking.restaurant_id ?? undefined,
        bookingId,
        context: {
          holdId,
          code: rpcFailure.code ?? null,
        },
        severity: "warning",
      }).catch(() => {});
      return confirmHoldAssignmentLegacy(fallbackContext);
    }

    throw rpcFailure;
  }

  const rows = Array.isArray(rpcData) ? rpcData : [];
  if (rows.length === 0) {
    throw new AssignTablesRpcError({
      message: "confirm_hold_assignment_tx returned no assignments",
      code: "ASSIGNMENT_EMPTY",
      details: null,
      hint: null,
    });
  }

  confirmHoldAssignmentRpcAvailable = true;

  const assignmentPayload = rows.map((row) => ({
    tableId: row.table_id,
    startAt: row.start_at,
    endAt: row.end_at,
    mergeGroupId: row.merge_group_id ?? null,
  }));
  const mergeGroupId = rows[0]?.merge_group_id ?? null;

  return synchronizeAssignments({
    supabase,
    booking,
    tableIds: normalizedTableIds,
    idempotencyKey: effectiveIdempotencyKey,
    assignments: assignmentPayload,
    startIso,
    endIso,
    actorId,
    mergeGroupId,
    holdContext: {
      holdId,
      zoneId: typedHoldRow.zone_id ?? null,
    },
    signal,
  });
}

type AtomicConfirmOptions = {
  bookingId: string;
  holdId: string;
  idempotencyKey: string;
  assignedBy?: string | null;
  historyReason: string;
  historyMetadata?: Json;
  historyChangedBy?: string | null;
  signal?: AbortSignal;
  client?: DbClient;
  policyRetryAttempts?: number;
};

type BookingAssignmentState = {
  bookingState: Tables<"bookings">["status"] | null;
  assignmentCount: number;
  restaurantId: string | null;
};

async function fetchBookingAssignmentState(params: {
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

async function reconcileOrphanedAssignments(params: {
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

function extractPolicyDriftDetails(error: AssignTablesRpcError): PolicyDriftDetails {
  if (error instanceof PolicyDriftError) {
    return error.driftDetails;
  }
  if (!error.details) {
    return { raw: null };
  }

  try {
    const parsed = JSON.parse(error.details) as Json;
    const parsedRecord = (typeof parsed === "object" && parsed !== null ? parsed : null) as
      | Record<string, Json>
      | null;
    const details: PolicyDriftDetails = { raw: parsed };

    if (parsedRecord) {
      if (typeof parsedRecord.expected === "string") {
        details.expectedHash = parsedRecord.expected;
      }
      if (typeof parsedRecord.actual === "string") {
        details.actualHash = parsedRecord.actual;
      }

      const adjacency = parsedRecord.adjacency as Record<string, Json> | undefined;
      if (adjacency && typeof adjacency === "object") {
        const expectedEdges = adjacency.expectedEdges;
        const actualEdges = adjacency.actualEdges;
        details.adjacency = {
          expectedEdges: Array.isArray(expectedEdges) ? (expectedEdges as string[]) : undefined,
          actualEdges: Array.isArray(actualEdges) ? (actualEdges as string[]) : undefined,
          expectedHash: typeof adjacency.expectedHash === "string" ? adjacency.expectedHash : undefined,
          actualHash: typeof adjacency.actualHash === "string" ? adjacency.actualHash : undefined,
        };
      }

      const zones = parsedRecord.zones as Record<string, Json> | undefined;
      if (zones && typeof zones === "object") {
        details.zones = {
          expected: zones.expected,
          actual: zones.actual,
        };
      }
    }

    return details;
  } catch {
    return { raw: error.details };
  }
}

async function publishPolicyDriftNotification(params: {
  bookingId: string;
  restaurantId?: string | null;
  holdId: string;
  attempt: number;
  recovered: boolean;
  details: PolicyDriftDetails;
  kind: PolicyDriftKind;
}): Promise<void> {
  try {
    const { enqueueOutboxEvent } = await import("@/server/outbox");
    await enqueueOutboxEvent({
      eventType: "capacity.policy.drift",
      restaurantId: params.restaurantId ?? null,
      bookingId: params.bookingId,
      payload: {
        holdId: params.holdId,
        attempt: params.attempt,
        recovered: params.recovered,
        details: params.details,
        kind: params.kind,
      },
    });
  } catch (error) {
    console.warn("[capacity.policy] failed to enqueue drift notification", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function confirmWithPolicyRetry(params: {
  supabase: DbClient;
  bookingId: string;
  restaurantId?: string | null;
  holdId: string;
  idempotencyKey: string;
  assignedBy: string | null;
  transition: ConfirmHoldTransition;
  signal?: AbortSignal;
  maxAttempts: number;
  enableRetry: boolean;
  contextRef: { currentHoldId: string };
}): Promise<{ assignments: TableAssignmentMember[]; attempts: number }> {
  const {
    supabase,
    bookingId,
    restaurantId,
    idempotencyKey,
    assignedBy,
    transition,
    signal,
    maxAttempts,
    enableRetry,
    contextRef,
  } = params;

  const totalAttempts = enableRetry ? Math.max(1, maxAttempts) : 1;
  let attempt = 0;
  let driftDetected = false;
  let driftNotificationSent = false;
  let lastError: unknown = null;
  let lastDriftInfo: { kind: PolicyDriftKind; details: PolicyDriftDetails } | null = null;

  while (attempt < totalAttempts) {
    try {
      const assignments = await confirmHoldAssignment({
        holdId: contextRef.currentHoldId,
        bookingId,
        idempotencyKey,
        assignedBy,
        client: supabase,
        signal,
        transition,
      });

      if (driftDetected) {
        const recoveryKind = lastDriftInfo?.kind ?? null;
        await recordObservabilityEvent({
          source: "capacity.policy",
          eventType: "policy_drift.recovered",
          restaurantId: restaurantId ?? undefined,
          bookingId,
          context: {
            attempts: attempt + 1,
            holdId: contextRef.currentHoldId,
            kind: recoveryKind,
          },
        });

        await publishPolicyDriftNotification({
          bookingId,
          restaurantId,
          holdId: contextRef.currentHoldId,
          attempt: attempt + 1,
          recovered: true,
          details: lastDriftInfo?.details ?? { raw: null },
          kind: recoveryKind ?? "policy",
        });
      }

      return { assignments, attempts: attempt + 1 };
    } catch (error) {
      if (error instanceof PolicyDriftError && enableRetry && attempt < totalAttempts - 1) {
        driftDetected = true;
        const details = error.driftDetails;
        lastDriftInfo = { kind: error.kind, details };

        await recordObservabilityEvent({
          source: "capacity.policy",
          eventType: "policy_drift.detected",
          severity: "warning",
          restaurantId: restaurantId ?? undefined,
          bookingId,
          context: {
            attempt: attempt + 1,
            holdId: contextRef.currentHoldId,
            details,
            kind: error.kind,
          },
        });

        if (!driftNotificationSent) {
          driftNotificationSent = true;
          await publishPolicyDriftNotification({
            bookingId,
            restaurantId,
            holdId: contextRef.currentHoldId,
            attempt: attempt + 1,
            recovered: false,
            details,
            kind: error.kind,
          });
        }

        try {
          await releaseHoldWithRetry({ holdId: contextRef.currentHoldId, client: supabase });
        } catch (releaseError) {
          console.warn("[capacity.policy] failed to release hold during policy drift retry", {
            holdId: contextRef.currentHoldId,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }

        const quote = await quoteTablesForBooking({
          bookingId,
          createdBy: assignedBy ?? "policy-retry",
          holdTtlSeconds: DEFAULT_HOLD_TTL_SECONDS,
          client: supabase,
          signal,
        });

        if (!quote.hold) {
          lastError = new AssignTablesRpcError({
            message: "Failed to re-quote tables after policy drift",
            code: "POLICY_REQUOTE_FAILED",
            details: serializeDetails({ reason: quote.reason ?? "NO_HOLD" }),
            hint: quote.reason ?? null,
          });
          break;
        }

        contextRef.currentHoldId = quote.hold.id;
        attempt += 1;
        continue;
      }

      lastError = error;
      break;
    }
  }

  if (driftDetected) {
    await recordObservabilityEvent({
      source: "capacity.policy",
      eventType: "policy_drift.failed",
      severity: "error",
      restaurantId: restaurantId ?? undefined,
      bookingId,
      context: {
        attempt: attempt + 1,
        holdId: contextRef.currentHoldId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
        kind: lastDriftInfo?.kind ?? null,
      },
    });
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new AssignTablesRpcError({
    message: "Policy drift retry failed",
    code: "POLICY_RETRY_FAILED",
    details: serializeDetails({ reason: "UNKNOWN" }),
    hint: null,
  });
}

export async function atomicConfirmAndTransition(options: AtomicConfirmOptions): Promise<TableAssignmentMember[]> {
  const {
    bookingId,
    holdId,
    idempotencyKey,
    assignedBy = null,
    historyReason,
    historyMetadata,
    historyChangedBy = null,
    signal,
    client,
  } = options;

  const supabase = ensureClient(client);
  const preState = await fetchBookingAssignmentState({ bookingId, client: supabase, signal });

  recordObservabilityEvent({
    source: "capacity.atomic_confirm",
    eventType: "transaction.started",
    restaurantId: preState.restaurantId ?? undefined,
    bookingId,
    context: {
      holdId,
      idempotencyKey,
      preStatus: preState.bookingState,
      preAssignments: preState.assignmentCount,
    },
  }).catch((startError) => {
    console.warn("[capacity.atomic_confirm] failed to record start event", {
      error: startError instanceof Error ? startError.message : String(startError),
    });
  });

  const policyContext = { currentHoldId: holdId };
  const policyRetryEnabled = isPolicyRequoteEnabled();

  try {
    const { assignments } = await confirmWithPolicyRetry({
      supabase,
      bookingId,
      restaurantId: preState.restaurantId ?? undefined,
      holdId,
      idempotencyKey,
      assignedBy,
      signal,
      transition: {
        targetStatus: "confirmed",
        historyReason,
        historyMetadata,
        historyChangedBy,
      },
      maxAttempts: options.policyRetryAttempts ?? 2,
      enableRetry: policyRetryEnabled,
      contextRef: policyContext,
    });

    const postState = await fetchBookingAssignmentState({ bookingId, client: supabase, signal });

    if (postState.bookingState !== "confirmed" || postState.assignmentCount === 0) {
      await reconcileOrphanedAssignments({
        bookingId,
        holdId: policyContext.currentHoldId,
        client: supabase,
        signal,
      });

      recordObservabilityEvent({
        source: "capacity.atomic_confirm",
        eventType: "transaction.reconciled_mismatch",
        restaurantId: postState.restaurantId ?? undefined,
        bookingId,
        context: {
          holdId: policyContext.currentHoldId,
          idempotencyKey,
          postStatus: postState.bookingState,
          postAssignments: postState.assignmentCount,
        },
        severity: "warning",
      });

      throw new AssignTablesRpcError({
        message: "Atomic confirmation completed but reconciliation failed",
        code: "STATE_RECONCILIATION_FAILED",
        details: serializeDetails({
          bookingState: postState.bookingState,
          assignmentCount: postState.assignmentCount,
        }),
        hint: "Investigate mismatch and retry confirmation if safe.",
      });
    }

    recordObservabilityEvent({
      source: "capacity.atomic_confirm",
      eventType: "transaction.succeeded",
      restaurantId: postState.restaurantId ?? undefined,
      bookingId,
      context: {
        holdId: policyContext.currentHoldId,
        idempotencyKey,
        assignments: postState.assignmentCount,
      },
    }).catch((successError) => {
      console.warn("[capacity.atomic_confirm] failed to record success event", {
        error: successError instanceof Error ? successError.message : String(successError),
      });
    });

    return assignments;
  } catch (error) {
    await reconcileOrphanedAssignments({
      bookingId,
      holdId: policyContext.currentHoldId,
      client: supabase,
      signal,
    });

    recordObservabilityEvent({
      source: "capacity.atomic_confirm",
      eventType: "transaction.failed",
      restaurantId: preState.restaurantId ?? undefined,
      bookingId,
      context: {
        holdId: policyContext.currentHoldId,
        idempotencyKey,
        error: error instanceof Error ? error.message : String(error),
      },
      severity: "error",
    });

    throw error;
  }
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
  const { window } = computeBookingWindowWithFallback({
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
  const policyVersion = hashPolicyVersion(policy);
  const deterministicKey = createDeterministicIdempotencyKey({
    tenantId: booking.restaurant_id,
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    policyVersion,
  });
  const idempotencyKey = options?.idempotencyKey ?? deterministicKey;
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
