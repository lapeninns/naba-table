import { DateTime } from "luxon";

import { isHoldStrictConflictsEnabled, getHoldMinTtlSeconds, getHoldRateWindowSeconds, getHoldRateMaxPerBooking } from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Json, Tables, TablesInsert } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

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

type TableHoldWindowRow = {
  hold_id: string;
  booking_id: string | null;
  restaurant_id: string;
  table_id: string;
  start_at: string;
  end_at: string;
  expires_at: string;
};

export type ReleaseTableHoldInput = {
  holdId: string;
  client?: DbClient;
};

// Legacy confirmTableHold path has been removed in favor of the
// allocator v2 flow implemented in server/capacity/tables.ts
// (confirmHoldAssignment). Keeping error classes below for reuse.

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

export type ExtendTableHoldInput = {
  holdId: string;
  extendSeconds?: number;
  newExpiresAt?: string;
  actorId?: string | null;
  client?: DbClient;
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

async function configureHoldStrictConflictSession(client: DbClient): Promise<void> {
  const enabled = isHoldStrictConflictsEnabled();
  if (typeof client.rpc !== "function") {
    return;
  }
  try {
    const { error } = await client.rpc("set_hold_conflict_enforcement", { enabled });
    if (error) {
      console.warn("[capacity.hold] failed to configure strict conflict enforcement", {
        enabled,
        error: error.message ?? error,
      });
    }
    // Best-effort verification
    try {
      const { data, error: verifyError } = await client.rpc("is_holds_strict_conflicts_enabled");
      if (verifyError) {
        console.warn("[capacity.hold] strict conflict verification failed", {
          error: verifyError.message ?? verifyError,
        });
      } else if (enabled && !data) {
        console.error("[capacity.hold] strict conflict enforcement not honored by server (GUC off)");
      }
    } catch (e) {
      console.warn("[capacity.hold] strict conflict verification errored", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } catch (error) {
    console.warn("[capacity.hold] failed to configure strict conflict enforcement", {
      enabled,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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

type HoldRowWithMembers = Tables<"table_holds"> & {
  table_hold_members?: unknown;
};

function extractTableIdsFromMembers(members: unknown): string[] {
  if (!Array.isArray(members)) {
    return [];
  }

  return members
    .map((member) => {
      if (!member || typeof member !== "object") {
        return null;
      }

      const tableId = (member as { table_id?: unknown }).table_id;
      return typeof tableId === "string" ? tableId : null;
    })
    .filter((tableId): tableId is string => tableId !== null);
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
  await configureHoldStrictConflictSession(supabase);

  // Enforce minimum TTL policy (clamp up)
  try {
    const minTtl = getHoldMinTtlSeconds();
    const nowIso = DateTime.now().toUTC();
    const requested = DateTime.fromISO(expiresAt).toUTC();
    if (requested.isValid) {
      const ttlSec = Math.max(0, Math.floor(requested.diff(nowIso, "seconds").seconds));
      if (ttlSec < minTtl) {
        const clamped = nowIso.plus({ seconds: minTtl }).toISO();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (input as any).expiresAt = clamped;
      }
    }
  } catch {
    // ignore TTL enforcement errors to avoid blocking
  }

  // Rate limit per user per booking within window
  if (createdBy && bookingId) {
    try {
      const windowSec = getHoldRateWindowSeconds();
      const maxPer = getHoldRateMaxPerBooking();
      const cutoff = DateTime.now().minus({ seconds: windowSec }).toISO();
      const { count, error: countError } = await supabase
        .from("table_holds")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId)
        .eq("created_by", createdBy)
        .gt("created_at", cutoff as string);
      if (!countError && typeof count === "number" && count >= maxPer) {
        throw new AssignTablesRpcError({
          message: "Too many holds recently for this booking. Please wait before trying again.",
          code: "RPC_VALIDATION",
          details: JSON.stringify({ reason: "HOLD_RATE_LIMIT", windowSeconds: windowSec, maxPerBooking: maxPer }),
          hint: "Reduce attempts or wait a moment, then retry.",
        });
      }
    } catch (e) {
      if (e instanceof AssignTablesRpcError) {
        throw e;
      }
      // If rate-limit check fails unexpectedly, proceed to avoid false positives.
    }
  }

  if (isHoldStrictConflictsEnabled()) {
    try {
      const conflicts = await findHoldConflicts({
        restaurantId,
        tableIds,
        startAt,
        endAt,
        client: supabase,
      });
      const blockingConflicts = conflicts.filter((conflict) => conflict.bookingId !== bookingId);
      if (blockingConflicts.length > 0) {
        const { emitHoldStrictConflict } = await import("./telemetry");
        await emitHoldStrictConflict({
          restaurantId,
          bookingId,
          tableIds,
          startAt,
          endAt,
          conflicts: blockingConflicts.map((conflict) => ({
            holdId: conflict.holdId,
            bookingId: conflict.bookingId,
            tableIds: conflict.tableIds,
            startAt: conflict.startAt,
            endAt: conflict.endAt,
            expiresAt: conflict.expiresAt,
          })),
        });
        throw new HoldConflictError("Existing holds conflict with requested tables", blockingConflicts[0]?.holdId);
      }
    } catch (error) {
      if (error instanceof HoldConflictError) {
        throw error;
      }
      console.warn("[capacity.hold] strict conflict evaluation failed; proceeding with relaxed checks", {
        restaurantId,
        error,
      });
    }
  }

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
  await configureHoldStrictConflictSession(supabase);
  await supabase.from("table_hold_members").delete().eq("hold_id", holdId);
  await supabase.from("table_holds").delete().eq("id", holdId);
}

export async function extendTableHold(input: ExtendTableHoldInput): Promise<TableHold> {
  const { holdId, extendSeconds, newExpiresAt, actorId = null, client } = input;
  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);

  const { data: holdRow, error: fetchError } = await supabase
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("id", holdId)
    .maybeSingle();

  if (fetchError || !holdRow) {
    throw new HoldNotFoundError();
  }

  const currentHold = holdRow as HoldRowWithMembers;
  // Authorization: only creator or elevated role may extend the hold
  if (!actorId) {
    throw new AssignTablesRpcError({
      message: "Only the creator or elevated roles may extend holds",
      code: "AUTH_FORBIDDEN",
      details: null,
      hint: null,
    });
  }
  if (currentHold.created_by && currentHold.created_by !== actorId) {
    try {
      const { data: membership } = await supabase
        .from("restaurant_memberships")
        .select("role")
        .eq("restaurant_id", currentHold.restaurant_id)
        .eq("user_id", actorId)
        .maybeSingle();
      const role = (membership as { role?: string } | null)?.role ?? null;
      const elevated = role && ["admin", "manager", "owner"].includes(role);
      if (!elevated) {
        throw new AssignTablesRpcError({
          message: "Only the creator or elevated roles may extend holds",
          code: "AUTH_FORBIDDEN",
          details: null,
          hint: null,
        });
      }
    } catch (e) {
      if (e instanceof AssignTablesRpcError) {
        throw e;
      }
      // If membership lookup fails, deny by default
      throw new AssignTablesRpcError({
        message: "Only the creator or elevated roles may extend holds",
        code: "AUTH_FORBIDDEN",
        details: null,
        hint: null,
      });
    }
  }
  const memberTableIds = extractTableIdsFromMembers(currentHold.table_hold_members ?? null);
  const currentExpires = DateTime.fromISO(currentHold.expires_at ?? "").toUTC();
  if (!currentExpires.isValid) {
    throw new HoldConflictError("Hold expiration timestamp invalid", holdId);
  }

  let targetExpiry: DateTime | null = null;
  if (typeof newExpiresAt === "string") {
    const candidate = DateTime.fromISO(newExpiresAt).toUTC();
    if (candidate.isValid) {
      targetExpiry = candidate;
    }
  }

  if (!targetExpiry && typeof extendSeconds === "number" && Number.isFinite(extendSeconds)) {
    targetExpiry = currentExpires.plus({ seconds: extendSeconds });
  }

  if (!targetExpiry || !targetExpiry.isValid) {
    throw new HoldConflictError("Cannot extend hold without a valid expiry" , holdId);
  }

  if (targetExpiry <= currentExpires) {
    return normalizeHold(currentHold as Tables<"table_holds">, memberTableIds);
  }

  const targetIso = targetExpiry.toUTC().toISO();
  const currentExpiresIso = currentExpires.toISO();
  if (!targetIso || !currentExpiresIso) {
    throw new HoldConflictError("Failed to normalize hold expiry", holdId);
  }
  const { data: updatedRow, error: updateError } = await supabase
    .from("table_holds")
    .update({
      expires_at: targetIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holdId)
    .select("*, table_hold_members(table_id)")
    .maybeSingle();

  if (updateError || !updatedRow) {
    throw new HoldConflictError(updateError?.message ?? "Failed to extend hold", holdId);
  }

  const updatedHold = updatedRow as HoldRowWithMembers;
  const updatedTableIds = extractTableIdsFromMembers(updatedHold.table_hold_members ?? null);

  const { emitHoldExtended } = await import("./telemetry");
  await emitHoldExtended({
    holdId,
    bookingId: updatedHold.booking_id,
    restaurantId: updatedHold.restaurant_id,
    zoneId: updatedHold.zone_id,
    tableIds: updatedTableIds,
    startAt: updatedHold.start_at,
    endAt: updatedHold.end_at,
    previousExpiresAt: currentExpiresIso,
    newExpiresAt: targetIso,
    actorId: actorId ?? updatedHold.created_by,
    metadata: updatedHold.metadata ?? null,
  });

  return normalizeHold(updatedHold as Tables<"table_holds">, updatedTableIds);
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

  return data.map((row) => {
    const holdRow = row as HoldRowWithMembers;
    const memberTableIds = extractTableIdsFromMembers(holdRow.table_hold_members ?? null);
    return normalizeHold(holdRow, memberTableIds);
  });
}

export async function findHoldConflicts(input: FindHoldConflictsInput): Promise<HoldConflictInfo[]> {
  const { restaurantId, tableIds, startAt, endAt, excludeHoldId = null, client } = input;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    return [];
  }

  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);
  if (!isHoldStrictConflictsEnabled()) {
    return await findHoldConflictsLegacy({ restaurantId, tableIds, startAt, endAt, excludeHoldId, client: supabase });
  }
  const nowIso = new Date().toISOString();
  const rangeLiteral = `[${startAt},${endAt})`;

  try {
    const { data, error } = await supabase
      .from("table_hold_windows")
      .select("hold_id, booking_id, restaurant_id, table_id, start_at, end_at, expires_at")
      .eq("restaurant_id", restaurantId)
      .gt("expires_at", nowIso)
      .in("table_id", tableIds)
      .filter("hold_window", "ov", rangeLiteral);

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "42P01") {
        return await findHoldConflictsLegacy({ restaurantId, tableIds, startAt, endAt, excludeHoldId, client: supabase });
      }
      console.warn("[capacity.hold] hold_window query failed; falling back to legacy conflict detection", {
        restaurantId,
        error,
      });
      return await findHoldConflictsLegacy({ restaurantId, tableIds, startAt, endAt, excludeHoldId, client: supabase });
    }

    const rows = Array.isArray(data) ? (data as TableHoldWindowRow[]) : [];
    if (rows.length === 0) {
      return [];
    }

    const grouped = new Map<string, HoldConflictInfo>();

    for (const row of rows) {
      if (!row || (excludeHoldId && row.hold_id === excludeHoldId)) {
        continue;
      }
      if (!intervalsOverlap(row.start_at, row.end_at, startAt, endAt)) {
        continue;
      }
      const key = row.hold_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          holdId: row.hold_id,
          bookingId: row.booking_id,
          tableIds: [],
          startAt: row.start_at,
          endAt: row.end_at,
          expiresAt: row.expires_at,
        });
      }
      const entry = grouped.get(key)!;
      if (!entry.tableIds.includes(row.table_id)) {
        entry.tableIds.push(row.table_id);
      }
    }

    return Array.from(grouped.values());
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01") {
      return await findHoldConflictsLegacy({ restaurantId, tableIds, startAt, endAt, excludeHoldId, client: supabase });
    }
    console.warn("[capacity.hold] conflict evaluation failed; using legacy fallback", {
      restaurantId,
      error,
    });
    return await findHoldConflictsLegacy({ restaurantId, tableIds, startAt, endAt, excludeHoldId, client: supabase });
  }
}

async function findHoldConflictsLegacy(params: {
  restaurantId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  excludeHoldId?: string | null;
  client: DbClient;
}): Promise<HoldConflictInfo[]> {
  const { restaurantId, tableIds, startAt, endAt, excludeHoldId = null, client } = params;

  const query = client
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

    if (!memberTableIds.some((id) => tableIds.includes(id))) {
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

// Legacy confirmTableHold removed. See confirmHoldAssignment in tables.ts (allocator v2).

export async function sweepExpiredHolds(input?: SweepExpiredHoldsInput): Promise<SweepExpiredHoldsResult> {
  const { now, limit = 100, client } = input ?? {};
  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);
  const cutoff = now ?? new Date().toISOString();

  const { data, error } = await supabase
    .from("table_holds")
    .select("id")
    .lte("expires_at", cutoff)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("[capacity.hold] sweepExpiredHolds failed", {
      error,
      cutoff,
      limit,
    });
    return {
      total: 0,
      holdIds: [],
    };
  }

  if (!data || data.length === 0) {
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
