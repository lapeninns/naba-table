import { computePayloadChecksum } from "../v2";
import { TABLE_RESOURCE_TYPE } from "./constants";
import {
  applyAbortSignal,
  loadTableAssignmentsForTables,
  type BookingRow,
  type DbClient,
} from "./supabase";
import { normalizeIsoString } from "./utils";

import type { TableAssignmentMember } from "./types";

export type RawAssignmentRecord = {
  tableId: string;
  startAt?: string | null;
  endAt?: string | null;
  mergeGroupId?: string | null;
};

export type AssignmentSyncParams = {
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

const ASSIGNMENT_REFRESH_ATTEMPTS = 2;
const ASSIGNMENT_REFRESH_DELAY_MS = 15;

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export async function synchronizeAssignments(params: AssignmentSyncParams): Promise<TableAssignmentMember[]> {
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
