import { DateTime } from "luxon";

import { isAllocatorAdjacencyRequired } from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Json, Tables } from "@/types/supabase";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

const MISSING_TABLE_ERROR_CODES = new Set(["42P01", "PGRST202"]);
const PERMISSION_DENIED_ERROR_CODES = new Set(["42501", "PGRST301"]);

function isMissingSupabaseTableError(
  error: PostgrestError | null | undefined,
  table: string,
): boolean {
  if (!error) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  if (code && MISSING_TABLE_ERROR_CODES.has(code)) {
    return true;
  }

  const normalizedTable = table.toLowerCase();
  const schemaQualified = `public.${normalizedTable}`;

  const toText = (value: unknown): string => {
    return typeof value === "string" ? value.toLowerCase() : "";
  };

  const haystacks = [toText(error.message), toText(error.details), toText((error as { hint?: unknown })?.hint)];

  return haystacks.some((text) => {
    if (!text) {
      return false;
    }

    const referencesTable =
      text.includes(schemaQualified) ||
      text.includes(`"${schemaQualified}"`) ||
      text.includes(`'${schemaQualified}'`) ||
      text.includes(normalizedTable);

    if (!referencesTable) {
      return false;
    }

    return (
      text.includes("schema cache") ||
      text.includes("does not exist") ||
      text.includes("missing sql table") ||
      text.includes("could not find the table")
    );
  });
}

function isPermissionDeniedError(
  error: PostgrestError | null | undefined,
  table: string,
): boolean {
  if (!error) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  if (code && PERMISSION_DENIED_ERROR_CODES.has(code)) {
    return true;
  }

  const normalizedTable = table.toLowerCase();
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  return message.includes("permission denied") && message.includes(normalizedTable);
}

export class HoldConflictError extends Error {
  holdId?: string;
  constructor(message: string, holdId?: string) {
    super(message);
    this.name = "HoldConflictError";
    this.holdId = holdId;
  }
}

export class HoldNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HoldNotFoundError";
  }
}

export type TableHoldSummary = {
  id: string;
  bookingId: string | null;
  restaurantId: string;
  zoneId: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  tableIds: string[];
};

export type ConfirmHoldResult = {
  tableId: string;
  assignmentId?: string;
  startAt?: string | null;
  endAt?: string | null;
  mergeGroupId?: string | null;
};

type HoldRow = Tables<"table_holds"> & {
  table_hold_members: { table_id: string }[] | null;
};

function mapHoldRow(row: HoldRow): TableHoldSummary {
  const members = Array.isArray(row.table_hold_members) ? row.table_hold_members : [];
  const tableIds = members
    .map((member) => member.table_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  return {
    id: row.id,
    bookingId: row.booking_id ?? null,
    restaurantId: row.restaurant_id,
    zoneId: row.zone_id,
    startAt: row.start_at,
    endAt: row.end_at,
    expiresAt: row.expires_at,
    tableIds,
  };
}

function resolveClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function toRange(startAt: string, endAt: string): string {
  return `[${startAt},${endAt})`;
}

export async function cleanupHoldArtifacts(client: DbClient, holdId: string): Promise<void> {
  try {
    await client.from("allocations").delete().match({
      resource_type: "hold",
      resource_id: holdId,
    });
  } catch (error) {
    console.error("[capacity][holds] failed to remove mirrored allocation", { holdId, error });
  }

  try {
    await client.from("table_holds").delete().eq("id", holdId);
  } catch (error) {
    console.error("[capacity][holds] failed to delete hold shell during cleanup", { holdId, error });
  }
}

function normalizeTableIds(tableIds: string[]): string[] {
  const unique = new Set(tableIds.filter((value) => typeof value === "string" && value.length > 0));
  return Array.from(unique);
}

export type HoldConflictInfo = {
  holdId: string;
  bookingId: string | null;
  tableIds: string[];
  startAt: string;
  endAt: string;
  expiresAt: string;
};

export async function listActiveHoldsForBooking(params: { bookingId: string; client?: DbClient }): Promise<TableHoldSummary[]> {
  const { bookingId, client } = params;
  const supabase = resolveClient(client);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("table_holds")
    .select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
    .eq("booking_id", bookingId)
    .gt("expires_at", nowIso);

  if (error) {
    if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
      console.warn("[capacity][holds] table_holds unavailable or access denied; returning empty holds list", {
        bookingId,
        error,
      });
      // Return empty array when table is unavailable
      return [];
    }
    throw new Error(`Failed to list active holds for booking ${bookingId}: ${error.message}`);
  }

  return (data ?? []).map((row) => mapHoldRow(row as HoldRow));
}

export async function findHoldConflicts(params: {
  restaurantId: string;
  zoneId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  excludeHoldId?: string | null;
  ignoreBookingId?: string | null;
  client?: DbClient;
}): Promise<HoldConflictInfo[]> {
  const { restaurantId, zoneId, tableIds, startAt, endAt, excludeHoldId, ignoreBookingId, client } = params;
  const supabase = resolveClient(client);

  if (tableIds.length === 0) {
    return [];
  }

  const nowIso = new Date().toISOString();

  let query = supabase
    .from("table_holds")
    .select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .eq("zone_id", zoneId)
    .gt("expires_at", nowIso)
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (excludeHoldId) {
    query = query.neq("id", excludeHoldId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
      console.warn("[capacity][holds] table_holds unavailable or access denied; skipping conflict check", {
        restaurantId,
        zoneId,
        error,
      });
      // Return empty conflicts array when table is unavailable
      return [];
    }
    throw new Error(`Failed to inspect hold conflicts: ${error.message}`);
  }

  const selection = new Set(tableIds.filter((value) => typeof value === "string" && value.length > 0));
  const conflicts: HoldConflictInfo[] = [];

  for (const entry of data ?? []) {
    const hold = mapHoldRow(entry as HoldRow);

    if (ignoreBookingId && hold.bookingId && hold.bookingId === ignoreBookingId) {
      continue;
    }

    const intersects = hold.tableIds.some((tableId) => selection.has(tableId));
    if (!intersects) {
      continue;
    }

    conflicts.push({
      holdId: hold.id,
      bookingId: hold.bookingId,
      tableIds: hold.tableIds,
      startAt: hold.startAt,
      endAt: hold.endAt,
      expiresAt: hold.expiresAt,
    });
  }

  return conflicts;
}

export class AssignTablesRpcError extends Error {
  code?: string | null;
  details?: string | null;
  hint?: string | null;

  constructor(error: PostgrestError) {
    const missingRpc = error.code === "42883";
    const message = missingRpc
      ? "assign_tables_atomic_v2 RPC is not available; run the latest Supabase migrations."
      : error.message ?? "assign_tables_atomic_v2 failed";
    super(message);
    this.name = "AssignTablesRpcError";
    this.code = error.code;
    this.details = error.details ?? null;
    this.hint = missingRpc
      ? "Apply migration 20251026105000_assign_tables_atomic_v2.sql and ensure service role grants."
      : error.hint ?? null;
  }
}

export async function createTableHold(params: {
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
}): Promise<TableHoldSummary> {
  const {
    bookingId,
    restaurantId,
    zoneId,
    tableIds: rawTableIds,
    startAt,
    endAt,
    expiresAt,
    createdBy,
    metadata,
    client,
  } = params;

  const tableIds = normalizeTableIds(rawTableIds);
  if (tableIds.length === 0) {
    throw new Error("createTableHold requires at least one table id");
  }

  if (!startAt || !endAt || DateTime.fromISO(startAt) >= DateTime.fromISO(endAt)) {
    throw new Error("Invalid hold window");
  }

  if (!expiresAt || DateTime.fromISO(expiresAt) <= DateTime.utc()) {
    throw new Error("ExpiresAt must be in the future");
  }

  const supabase = resolveClient(client);
  const nowIso = new Date().toISOString();

  const { data: overlapping, error: overlapError } = await supabase
    .from("table_holds")
    .select("id, booking_id, start_at, end_at, table_hold_members(table_id)")
    .eq("zone_id", zoneId)
    .gt("expires_at", nowIso)
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (overlapError) {
    if (isMissingSupabaseTableError(overlapError, "table_holds") || isPermissionDeniedError(overlapError, "table_holds")) {
      console.warn("[capacity][holds] table_holds unavailable or access denied; skipping overlap check for createTableHold", {
        restaurantId,
        zoneId,
        error: overlapError,
      });
      // Continue without overlap check if table is unavailable
    } else {
      throw new Error(`Failed to inspect existing holds: ${overlapError.message}`);
    }
  }

  const tableIdSet = new Set(tableIds);
  const conflicting = (overlapping ?? []).find((hold) => {
    const members = hold.table_hold_members ?? [];
    const intersects = members.some((member) => tableIdSet.has(member.table_id ?? ""));
    if (!intersects) {
      return false;
    }

    if (hold.booking_id && bookingId && hold.booking_id === bookingId) {
      // Same booking; treat as conflict so caller can reuse existing hold explicitly.
      return true;
    }
    return true;
  });

  if (conflicting) {
    throw new HoldConflictError("Hold already exists for requested tables/window", conflicting.id ?? undefined);
  }

  const holdInsert = await supabase
    .from("table_holds")
    .insert({
      booking_id: bookingId,
      restaurant_id: restaurantId,
      zone_id: zoneId,
      start_at: startAt,
      end_at: endAt,
      expires_at: expiresAt,
      created_by: createdBy ?? null,
      metadata: (metadata ?? null) as Tables<"table_holds">["metadata"],
    })
    .select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at")
    .maybeSingle();

  if (holdInsert.error || !holdInsert.data) {
    const error = holdInsert.error;
    if (error && (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds"))) {
      throw new Error(`Cannot create hold: table_holds is unavailable or access is denied. Please check database permissions.`);
    }
    throw new Error(`Failed to create hold: ${holdInsert.error?.message ?? "unknown error"}`);
  }

  const hold = holdInsert.data;

  const memberRows = tableIds.map((tableId) => ({
    hold_id: hold.id,
    table_id: tableId,
  }));

  const membersInsert = await supabase.from("table_hold_members").insert(memberRows);
  if (membersInsert.error) {
    await cleanupHoldArtifacts(supabase, hold.id);
    throw new Error(`Failed to register hold members: ${membersInsert.error.message}`);
  }

  const allocationInsert = await supabase.from("allocations").insert({
    booking_id: bookingId,
    restaurant_id: restaurantId,
    resource_type: "hold",
    resource_id: hold.id,
    window: toRange(startAt, endAt),
    created_by: createdBy ?? null,
    shadow: false,
    is_maintenance: false,
  });

  if (allocationInsert.error) {
    await cleanupHoldArtifacts(supabase, hold.id);
    throw new Error(`Failed to mirror hold into allocations: ${allocationInsert.error.message}`);
  }

  return {
    id: hold.id,
    bookingId: hold.booking_id ?? null,
    restaurantId: hold.restaurant_id,
    zoneId: hold.zone_id,
    startAt: hold.start_at,
    endAt: hold.end_at,
    expiresAt: hold.expires_at,
    tableIds,
  };
}

function mapAssignmentsToResult(tableIds: string[], rows: any[], assignmentRows: any[]): ConfirmHoldResult[] {
  const assignmentByTable = new Map<string, string>();
  for (const row of assignmentRows ?? []) {
    if (row && typeof row.table_id === "string" && typeof row.id === "string") {
      assignmentByTable.set(row.table_id, row.id);
    }
  }

  return rows.map((row: any) => ({
    tableId: row.table_id as string,
    assignmentId: assignmentByTable.get(row.table_id as string),
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    mergeGroupId: row.merge_group_id ?? null,
  }));
}

export async function confirmTableHold(params: {
  holdId: string;
  bookingId: string;
  idempotencyKey: string;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  client?: DbClient;
}): Promise<ConfirmHoldResult[]> {
  const { holdId, bookingId, idempotencyKey, requireAdjacency, assignedBy, client } = params;

  const supabase = resolveClient(client);
  const now = DateTime.utc();

  const { data: holdRow, error: holdError } = await supabase
    .from("table_holds")
    .select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
    .eq("id", holdId)
    .maybeSingle();

  if (holdError) {
    if (isMissingSupabaseTableError(holdError, "table_holds") || isPermissionDeniedError(holdError, "table_holds")) {
      throw new Error(`Cannot confirm hold: table_holds is unavailable or access is denied. Please check database permissions.`);
    }
    throw new Error(`Failed to load hold ${holdId}: ${holdError.message}`);
  }

  if (!holdRow) {
    throw new HoldNotFoundError(`Hold ${holdId} not found`);
  }

  if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
    throw new HoldConflictError("Hold belongs to a different booking", holdRow.id ?? undefined);
  }

  if (DateTime.fromISO(holdRow.expires_at ?? "").diff(now).milliseconds <= 0) {
    await cleanupHoldArtifacts(supabase, holdRow.id);
    throw new HoldConflictError("Hold has already expired", holdRow.id ?? undefined);
  }

  const memberTableIds =
    holdRow.table_hold_members?.map((member) => member.table_id).filter((value): value is string => !!value) ?? [];
  if (memberTableIds.length === 0) {
    await cleanupHoldArtifacts(supabase, holdRow.id);
    throw new Error("Hold has no table members");
  }

  const adjacencyRequired =
    typeof requireAdjacency === "boolean" ? requireAdjacency : isAllocatorAdjacencyRequired();

  const { data, error } = await supabase.rpc("assign_tables_atomic_v2", {
    p_booking_id: bookingId,
    p_table_ids: memberTableIds,
    p_idempotency_key: idempotencyKey,
    p_require_adjacency: adjacencyRequired,
    p_assigned_by: assignedBy ?? null,
  });

  if (error) {
    throw new AssignTablesRpcError(error);
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    throw new Error("assign_tables_atomic_v2 returned no assignments");
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("booking_table_assignments")
    .select("table_id, id")
    .eq("booking_id", bookingId)
    .in("table_id", memberTableIds);

  if (assignmentError) {
    throw new Error(`Failed to fetch assignment ids after confirming hold: ${assignmentError.message}`);
  }

  await cleanupHoldArtifacts(supabase, holdRow.id);

  return mapAssignmentsToResult(memberTableIds, rows, assignmentRows ?? []);
}

export async function releaseTableHold(params: { holdId: string; client?: DbClient }): Promise<void> {
  const { holdId, client } = params;
  const supabase = resolveClient(client);
  await cleanupHoldArtifacts(supabase, holdId);
}

export async function sweepExpiredHolds(params?: {
  now?: string;
  limit?: number;
  client?: DbClient;
}): Promise<{ total: number; deleted: number }> {
  const { now, limit = 50, client } = params ?? {};
  const supabase = resolveClient(client);
  const cutoff = now ?? new Date().toISOString();

  const { data: holds, error } = await supabase
    .from("table_holds")
    .select("id")
    .lte("expires_at", cutoff)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
      console.warn("[capacity][holds] table_holds unavailable or access denied; skipping expired holds cleanup", {
        error,
      });
      return { total: 0, deleted: 0 };
    }
    throw new Error(`Failed to list expired holds: ${error.message}`);
  }

  const holdIds = (holds ?? []).map((hold) => hold.id).filter((value): value is string => !!value);

  for (const holdId of holdIds) {
    await cleanupHoldArtifacts(supabase, holdId);
  }

  return { total: holdIds.length, deleted: holdIds.length };
}
