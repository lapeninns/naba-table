import { DateTime } from "luxon";

import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Json, Tables, TablesInsert } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

export type TableHold = {
  id: string;
  bookingId: string | null;
  restaurantId: string;
  zoneId: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  tableIds: string[];
  createdBy: string | null;
  metadata: Json | null;
};

export type HoldConflictInfo = {
  holdId: string;
  bookingId: string | null;
  tableIds: string[];
  startAt: string;
  endAt: string;
  expiresAt: string;
};

export type CreateTableHoldInput = {
  bookingId: string | null;
  restaurantId: string;
  zoneId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  expiresAt: string;
  createdBy?: string | null;
  metadata?: Json | null;
  client?: DbClient;
};

export type ReleaseTableHoldInput = {
  holdId: string;
  client?: DbClient;
};

export type ConfirmTableHoldInput = {
  holdId: string;
  bookingId: string;
  idempotencyKey?: string | null;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  client?: DbClient;
};

export type ConfirmedAssignment = {
  tableId: string;
  startAt: string;
  endAt: string;
  mergeGroupId: string | null;
};

export type FindHoldConflictsInput = {
  restaurantId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  excludeHoldId?: string | null;
  client?: DbClient;
};

export type ListActiveHoldsInput = {
  bookingId: string;
  client?: DbClient;
};

export type SweepExpiredHoldsInput = {
  now?: string;
  limit?: number;
  client?: DbClient;
};

export type SweepExpiredHoldsResult = {
  total: number;
  holdIds: string[];
};

export class HoldConflictError extends Error {
  constructor(message: string, public readonly holdId?: string) {
    super(message);
    this.name = "HoldConflictError";
  }
}

export class HoldNotFoundError extends Error {
  constructor(message = "Table hold not found") {
    super(message);
    this.name = "HoldNotFoundError";
  }
}

export class AssignTablesRpcError extends Error {
  public readonly code?: string | null;
  public readonly details?: string | null;
  public readonly hint?: string | null;

  constructor(error: { message: string; code?: string | null; details?: string | null; hint?: string | null }) {
    super(error.message);
    this.name = "AssignTablesRpcError";
    this.code = error.code ?? null;
    this.details = error.details ?? null;
    this.hint = error.hint ?? null;
  }
}

function ensureClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function normalizeHold(row: Tables<"table_holds">, tableIds: string[]): TableHold {
  return {
    id: row.id,
    bookingId: row.booking_id,
    restaurantId: row.restaurant_id,
    zoneId: row.zone_id,
    startAt: row.start_at,
    endAt: row.end_at,
    expiresAt: row.expires_at,
    tableIds,
    createdBy: row.created_by,
    metadata: row.metadata ?? null,
  };
}

function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const startA = DateTime.fromISO(aStart);
  const endA = DateTime.fromISO(aEnd);
  const startB = DateTime.fromISO(bStart);
  const endB = DateTime.fromISO(bEnd);
  if (!startA.isValid || !endA.isValid || !startB.isValid || !endB.isValid) {
    return false;
  }
  return startA < endB && startB < endA;
}

export async function createTableHold(input: CreateTableHoldInput): Promise<TableHold> {
  const {
    bookingId,
    restaurantId,
    zoneId,
    tableIds,
    startAt,
    endAt,
    expiresAt,
    createdBy = null,
    metadata = null,
    client,
  } = input;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new HoldConflictError("Cannot create a hold without tables");
  }

  const supabase = ensureClient(client);

  const insertPayload: TablesInsert<"table_holds"> = {
    booking_id: bookingId,
    restaurant_id: restaurantId,
    zone_id: zoneId,
    start_at: startAt,
    end_at: endAt,
    expires_at: expiresAt,
    created_by: createdBy,
    metadata,
  };

  const { data: holdRow, error: insertError } = await supabase
    .from("table_holds")
    .insert(insertPayload)
    .select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, created_by, metadata")
    .maybeSingle();

  if (insertError || !holdRow) {
    throw new HoldConflictError(insertError?.message ?? "Failed to create table hold");
  }

  const memberRows = tableIds.map((tableId) => ({
    hold_id: holdRow.id,
    table_id: tableId,
  }));

  const { error: memberError } = await supabase.from("table_hold_members").insert(memberRows);

  if (memberError) {
    await supabase.from("table_holds").delete().eq("id", holdRow.id);
    throw new HoldConflictError(memberError.message ?? "Failed to record table hold members", holdRow.id);
  }

  const hold = normalizeHold(holdRow as Tables<"table_holds">, tableIds);

  const { emitHoldCreated } = await import("./telemetry");
  await emitHoldCreated({
    holdId: hold.id,
    bookingId: hold.bookingId,
    restaurantId: hold.restaurantId,
    zoneId: hold.zoneId,
    tableIds: hold.tableIds,
    startAt: hold.startAt,
    endAt: hold.endAt,
    expiresAt: hold.expiresAt,
    actorId: createdBy,
    metadata,
  });

  return hold;
}

export async function releaseTableHold(input: ReleaseTableHoldInput): Promise<void> {
  const { holdId, client } = input;
  const supabase = ensureClient(client);
  await supabase.from("table_hold_members").delete().eq("hold_id", holdId);
  await supabase.from("table_holds").delete().eq("id", holdId);
}

export async function listActiveHoldsForBooking(input: ListActiveHoldsInput): Promise<TableHold[]> {
  const { bookingId, client } = input;
  const supabase = ensureClient(client);

  const { data, error } = await supabase
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("booking_id", bookingId)
    .gt("expires_at", new Date().toISOString());

  if (error || !data) {
    return [];
  }

  return data.map((row) =>
    normalizeHold(row as Tables<"table_holds">, (row.table_hold_members ?? []).map((member: any) => member.table_id)),
  );
}

export async function findHoldConflicts(input: FindHoldConflictsInput): Promise<HoldConflictInfo[]> {
  const { restaurantId, tableIds, startAt, endAt, excludeHoldId = null, client } = input;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    return [];
  }

  const supabase = ensureClient(client);

  const query = supabase
    .from("table_holds")
    .select("id, booking_id, start_at, end_at, expires_at, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const conflicts: HoldConflictInfo[] = [];

  for (const row of data) {
    if (excludeHoldId && row.id === excludeHoldId) {
      continue;
    }

    const members = (row.table_hold_members ?? []) as Array<{ table_id: string }>;
    const memberTableIds = members.map((member) => member.table_id);

    const sharesTable = memberTableIds.some((id) => tableIds.includes(id));
    if (!sharesTable) {
      continue;
    }

    if (!intervalsOverlap(row.start_at, row.end_at, startAt, endAt)) {
      continue;
    }

    conflicts.push({
      holdId: row.id,
      bookingId: row.booking_id,
      tableIds: memberTableIds,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
    });
  }

  return conflicts;
}

export async function confirmTableHold(input: ConfirmTableHoldInput): Promise<ConfirmedAssignment[]> {
  const {
    holdId,
    bookingId,
    idempotencyKey = null,
    requireAdjacency = false,
    assignedBy = null,
    startAt = null,
    endAt = null,
    client,
  } = input;
  const supabase = ensureClient(client);

  const { data: holdRow, error: holdError } = await supabase
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("id", holdId)
    .maybeSingle();

  if (holdError) {
    throw new HoldNotFoundError(holdError.message ?? "Failed to load hold");
  }

  if (!holdRow) {
    throw new HoldNotFoundError();
  }

  if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
    throw new HoldConflictError("Hold is linked to a different booking", holdId);
  }

  const tableIds = (holdRow.table_hold_members ?? []).map((member: { table_id: string }) => member.table_id);
  if (tableIds.length === 0) {
    throw new HoldConflictError("Hold has no tables", holdId);
  }

  const effectiveStartAt = startAt ?? holdRow.start_at ?? null;
  const effectiveEndAt = endAt ?? holdRow.end_at ?? null;

  if (!effectiveStartAt || !effectiveEndAt) {
    throw new AssignTablesRpcError({
      message: "Unable to resolve assignment window for table hold",
      details: null,
      hint: null,
    });
  }

  const { data, error } = await supabase.rpc("assign_tables_atomic_v2", {
    p_booking_id: bookingId,
    p_table_ids: tableIds,
    p_idempotency_key: idempotencyKey,
    p_require_adjacency: requireAdjacency,
    p_assigned_by: assignedBy,
    p_start_at: effectiveStartAt,
    p_end_at: effectiveEndAt,
  });

  if (error) {
    const { emitRpcConflict } = await import("./telemetry");
    await emitRpcConflict({
      source: "confirm_table_hold",
      bookingId,
      restaurantId: holdRow.restaurant_id,
      tableIds,
      idempotencyKey,
      holdId,
      error: {
        code: error.code ?? null,
        message: error.message ?? "assign_tables_atomic_v2 failed",
        details: error.details ?? null,
        hint: error.hint ?? null,
      },
    });
    throw new AssignTablesRpcError({
      message: error.message ?? "assign_tables_atomic_v2 failed",
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  const assignments: ConfirmedAssignment[] = (Array.isArray(data) ? data : []).map((row: any) => ({
    tableId: row.table_id,
    startAt: row.start_at,
    endAt: row.end_at,
    mergeGroupId: row.merge_group_id ?? null,
  }));

  await supabase.from("table_holds").delete().eq("id", holdId);

  return assignments;
}

export async function sweepExpiredHolds(input?: SweepExpiredHoldsInput): Promise<SweepExpiredHoldsResult> {
  const { now, limit = 100, client } = input ?? {};
  const supabase = ensureClient(client);
  const cutoff = now ?? new Date().toISOString();

  const { data, error } = await supabase
    .from("table_holds")
    .select("id")
    .lte("expires_at", cutoff)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return {
      total: 0,
      holdIds: [],
    };
  }

  const holdIds = data.map((row) => row.id);
  await supabase.from("table_hold_members").delete().in("hold_id", holdIds);
  await supabase.from("table_holds").delete().in("id", holdIds);

  return {
    total: holdIds.length,
    holdIds,
  };
}
