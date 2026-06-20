import { DateTime } from 'luxon';

import { getHoldMinTtlSeconds } from '@/server/runtime-policy';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database, Json, Tables } from '@/types/supabase';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;

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
  constructor(
    message: string,
    public readonly holdId?: string,
  ) {
    super(message);
    this.name = 'HoldConflictError';
  }
}

export class HoldPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code?: string | null,
  ) {
    super(message);
    this.name = 'HoldPersistenceError';
  }
}

export class HoldNotFoundError extends Error {
  constructor(message = 'Table hold not found') {
    super(message);
    this.name = 'HoldNotFoundError';
  }
}

export class AssignTablesRpcError extends Error {
  public readonly code?: string | null;
  public readonly details?: string | null;
  public readonly hint?: string | null;

  constructor(error: {
    message: string;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  }) {
    super(error.message);
    this.name = 'AssignTablesRpcError';
    this.code = error.code ?? null;
    this.details = error.details ?? null;
    this.hint = error.hint ?? null;
  }
}

function ensureClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

async function configureHoldStrictConflictSession(client: DbClient): Promise<void> {
  const enabled = true;
  if (typeof client.rpc !== 'function') {
    throw new HoldConflictError('Strict hold conflict enforcement requires an RPC-capable client');
  }
  try {
    const { error } = await client.rpc('set_hold_conflict_enforcement', { enabled });
    if (error) {
      console.warn('[capacity.hold] failed to configure strict conflict enforcement', {
        enabled,
        error: error.message ?? error,
      });
    }
    // Best-effort verification
    try {
      const { data, error: verifyError } = await client.rpc('is_holds_strict_conflicts_enabled');
      if (verifyError) {
        console.warn('[capacity.hold] strict conflict verification failed', {
          error: verifyError.message ?? verifyError,
        });
      } else if (enabled && !data) {
        console.error(
          '[capacity.hold] strict conflict enforcement not honored by server (GUC off)',
        );
        throw new HoldConflictError('Strict hold conflict enforcement not honored by server');
      }
    } catch (e) {
      console.warn('[capacity.hold] strict conflict verification errored', {
        error: e instanceof Error ? e.message : String(e),
      });
      if (enabled) {
        throw e;
      }
    }
  } catch (error) {
    console.warn('[capacity.hold] failed to configure strict conflict enforcement', {
      enabled,
      error: error instanceof Error ? error.message : String(error),
    });
    if (enabled) {
      throw error;
    }
  }
}

export async function isStrictConflictSessionEnabled(client?: DbClient): Promise<boolean> {
  const supabase = ensureClient(client);
  try {
    const { data, error } = await supabase.rpc('is_holds_strict_conflicts_enabled');
    if (error) {
      throw new Error(error.message ?? String(error));
    }
    return Boolean(data);
  } catch (error) {
    console.warn('[capacity.hold] failed to verify strict conflict session flag', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function normalizeHold(row: Tables<'table_holds'>, tableIds: string[]): TableHold {
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

type HoldRowWithMembers = Tables<'table_holds'> & {
  table_hold_members?: unknown;
};

function extractTableIdsFromMembers(members: unknown): string[] {
  if (!Array.isArray(members)) {
    return [];
  }

  return members
    .map((member) => {
      if (!member || typeof member !== 'object') {
        return null;
      }

      const tableId = (member as { table_id?: unknown }).table_id;
      return typeof tableId === 'string' ? tableId : null;
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
    throw new HoldConflictError('Cannot create a hold without tables');
  }

  const supabase = ensureClient(client);
  const createdByUuid =
    typeof createdBy === 'string' &&
    /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.test(
      createdBy,
    )
      ? createdBy
      : null;
  await configureHoldStrictConflictSession(supabase);

  const parseUtc = (value: string) => DateTime.fromISO(value, { zone: 'utc' }).toUTC();

  let normalizedExpiry = parseUtc(expiresAt);
  const nowUtc = DateTime.now().toUTC();
  const minTtl = getHoldMinTtlSeconds();

  if (!normalizedExpiry.isValid) {
    normalizedExpiry = nowUtc.plus({ seconds: minTtl });
  }

  try {
    const ttlSec = Math.max(0, Math.floor(normalizedExpiry.diff(nowUtc, 'seconds').seconds));
    if (ttlSec < minTtl) {
      normalizedExpiry = nowUtc.plus({ seconds: minTtl });
    }
  } catch {
    normalizedExpiry = nowUtc.plus({ seconds: minTtl });
  }

  const normalizedExpiryIso = normalizedExpiry.toISO();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (input as any).expiresAt = normalizedExpiryIso;

  // When strict conflicts are enabled, avoid a TOCTOU race by relying on
  // database-level exclusion constraints and inserting the hold + members
  // atomically via a nested write in a single request.
  // We still emit telemetry for conflicts after-the-fact based on DB errors.

  // Build a nested insert payload. Types don't model nested writes, so cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertPayload: any = {
    booking_id: bookingId,
    restaurant_id: restaurantId,
    zone_id: zoneId,
    start_at: startAt,
    end_at: endAt,
    expires_at: normalizedExpiryIso,
    created_by: createdByUuid,
    metadata,
    table_hold_members: {
      data: Array.from(new Set(tableIds)).map((tableId) => ({ table_id: tableId })),
    },
  };

  // Single statement, atomic. If an exclusion constraint is violated due to a
  // concurrent hold, Postgres returns an error and nothing is persisted (no orphan hold row).
  const { data: inserted, error: nestedError } = await supabase
    .from('table_holds')
    .insert(insertPayload)
    .select(
      'id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, created_by, metadata, table_hold_members(table_id)',
    )
    .single();

  if (nestedError || !inserted) {
    const code = (nestedError as { code?: string } | null)?.code ?? null;
    const message =
      (nestedError as { message?: string } | null)?.message ?? String(nestedError ?? '');
    if (
      process.env.CAPACITY_LOG_HOLD_ERRORS === '1' ||
      process.env.CAPACITY_LOG_HOLD_ERRORS === 'true'
    ) {
      console.error('[capacity.hold] hold insert failed', {
        bookingId,
        restaurantId,
        tableIds,
        startAt,
        endAt,
        expiresAt,
        code,
        message,
      });
    }

    // Translate DB-level overlap to a domain HoldConflictError.
    if (code === '23P01' || /table_hold_windows_no_overlap|exclusion/i.test(message)) {
      // Best-effort pull current conflicts for telemetry
      try {
        const conflicts = await findHoldConflicts({
          restaurantId,
          tableIds,
          startAt,
          endAt,
          client: supabase,
        });
        const blocking = conflicts.filter((c) => c.bookingId !== bookingId);
        if (blocking.length > 0) {
          const { emitHoldStrictConflict } = await import('./telemetry');
          await emitHoldStrictConflict({
            restaurantId,
            bookingId,
            tableIds,
            startAt,
            endAt,
            conflicts: blocking.map((conflict) => ({
              holdId: conflict.holdId,
              bookingId: conflict.bookingId,
              tableIds: conflict.tableIds,
              startAt: conflict.startAt,
              endAt: conflict.endAt,
              expiresAt: conflict.expiresAt,
            })),
          });
          throw new HoldConflictError(
            'Existing holds conflict with requested tables',
            blocking[0]?.holdId,
          );
        }
      } catch {
        // Even if conflict enumeration fails, translate as a conflict.
      }
      throw new HoldConflictError('Existing holds conflict with requested tables');
    }

    // If PostgREST schema cache prevents nested writes, fallback to two-step insert
    if (code === 'PGRST204' || /schema cache|table_hold_members/.test(message)) {
      // Step 1: insert hold row
      const { data: holdRow, error: holdErr } = await supabase
        .from('table_holds')
        .insert({
          booking_id: bookingId,
          restaurant_id: restaurantId,
          zone_id: zoneId,
          start_at: startAt,
          end_at: endAt,
          expires_at: normalizedExpiryIso,
          created_by: createdByUuid,
          metadata,
        })
        .select(
          'id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, created_by, metadata',
        )
        .single();

      if (holdErr || !holdRow) {
        const fallbackCode = (holdErr as PostgrestError)?.code ?? null;
        const fallbackMessage =
          (holdErr as { message?: string } | null)?.message ||
          message ||
          'Failed to create table hold';
        if (
          process.env.CAPACITY_LOG_HOLD_ERRORS === '1' ||
          process.env.CAPACITY_LOG_HOLD_ERRORS === 'true'
        ) {
          console.error('[capacity.hold] fallback hold insert failed', {
            code: fallbackCode,
            message: fallbackMessage,
          });
        }
        throw new HoldPersistenceError(fallbackMessage, fallbackCode);
      }

      // Step 2: insert members
      const rows = Array.from(new Set(tableIds)).map((tableId) => ({
        hold_id: (holdRow as { id: string }).id,
        table_id: tableId,
      }));
      const { error: membersErr } = await supabase.from('table_hold_members').insert(rows);
      if (membersErr) {
        if (
          process.env.CAPACITY_LOG_HOLD_ERRORS === '1' ||
          process.env.CAPACITY_LOG_HOLD_ERRORS === 'true'
        ) {
          console.error('[capacity.hold] fallback hold members insert failed', {
            code: (membersErr as PostgrestError)?.code ?? null,
            message: (membersErr as PostgrestError)?.message ?? String(membersErr),
          });
        }
        // Best-effort cleanup
        await supabase
          .from('table_holds')
          .delete()
          .eq('id', (holdRow as { id: string }).id);
        const membersCode = (membersErr as PostgrestError)?.code ?? null;
        const membersMessage =
          (membersErr as { message?: string } | null)?.message ||
          message ||
          'Failed to create table hold members';
        throw new HoldPersistenceError(membersMessage, membersCode);
      }

      const hold: TableHold = {
        id: (holdRow as { id: string }).id,
        bookingId: (holdRow as { booking_id: string | null }).booking_id ?? null,
        restaurantId: (holdRow as { restaurant_id: string }).restaurant_id,
        zoneId: (holdRow as { zone_id: string }).zone_id,
        startAt: (holdRow as { start_at: string }).start_at,
        endAt: (holdRow as { end_at: string }).end_at,
        expiresAt: (holdRow as { expires_at: string }).expires_at,
        tableIds: Array.from(new Set(tableIds)),
        createdBy: (holdRow as { created_by: string | null }).created_by ?? null,
        metadata: (holdRow as { metadata: Json | null }).metadata ?? null,
      };

      const { emitHoldCreated } = await import('./telemetry');
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

    // Bubble other errors explicitly in a consistent error type for callers.
    throw new HoldPersistenceError(message || 'Failed to create table hold', code);
  }

  const memberTableIds = extractTableIdsFromMembers(
    (inserted as HoldRowWithMembers).table_hold_members ?? null,
  );
  const hold: TableHold = {
    id: (inserted as { id: string }).id,
    bookingId: (inserted as { booking_id: string | null }).booking_id ?? null,
    restaurantId: (inserted as { restaurant_id: string }).restaurant_id,
    zoneId: (inserted as { zone_id: string }).zone_id,
    startAt: (inserted as { start_at: string }).start_at,
    endAt: (inserted as { end_at: string }).end_at,
    expiresAt: (inserted as { expires_at: string }).expires_at,
    tableIds: memberTableIds,
    createdBy: (inserted as { created_by: string | null }).created_by ?? null,
    metadata: (inserted as { metadata: Json | null }).metadata ?? null,
  };

  const { emitHoldCreated } = await import('./telemetry');
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

async function manualDeleteHold(supabase: DbClient, holdId: string): Promise<void> {
  const { error: membersError } = await supabase
    .from('table_hold_members')
    .delete()
    .eq('hold_id', holdId);
  if (membersError) {
    throw new HoldPersistenceError(
      membersError.message ?? 'Failed to delete table hold members',
      membersError.code ?? null,
    );
  }

  const { error: holdError } = await supabase.from('table_holds').delete().eq('id', holdId);
  if (holdError) {
    throw new HoldPersistenceError(
      holdError.message ?? 'Failed to delete table hold',
      holdError.code ?? null,
    );
  }

  // Verify the hold row is actually gone; never report success on partial deletion.
  const { data: remaining, error: verifyError } = await supabase
    .from('table_holds')
    .select('id')
    .eq('id', holdId)
    .maybeSingle();
  if (verifyError) {
    throw new HoldPersistenceError(
      verifyError.message ?? 'Failed to verify table hold deletion',
      verifyError.code ?? null,
    );
  }
  if (remaining) {
    throw new HoldPersistenceError('Hold deletion did not remove the hold row', null);
  }
}

export async function releaseTableHold(input: ReleaseTableHoldInput): Promise<void> {
  const { holdId, client } = input;
  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);
  const rpcCall = supabase.rpc('release_hold_and_emit', {
    p_hold_id: holdId,
    // actor id is optional for system-triggered releases; Supabase RPC expects string | undefined
    p_actor_id: undefined,
  });
  const { data: rpcData, error: rpcError } = await rpcCall;

  // The RPC returns a boolean indicating whether a hold was actually deleted.
  // A falsy return with no error means the RPC did not delete the hold, so the
  // hold may still be active. Fall back to the manual delete (with verification)
  // rather than reporting success on partial/no deletion.
  const deleted = rpcData === true;
  if (rpcError || !deleted) {
    console.warn('[capacity.hold] release_hold_and_emit did not confirm deletion; falling back to manual delete', {
      holdId,
      deleted,
      code: rpcError?.code ?? null,
      message: rpcError?.message ?? null,
    });
    await manualDeleteHold(supabase, holdId);
  }
}

export async function extendTableHold(input: ExtendTableHoldInput): Promise<TableHold> {
  const { holdId, extendSeconds, newExpiresAt, actorId = null, client } = input;
  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);

  const { data: holdRow, error: fetchError } = await supabase
    .from('table_holds')
    .select('*, table_hold_members(table_id)')
    .eq('id', holdId)
    .maybeSingle();

  if (fetchError || !holdRow) {
    throw new HoldNotFoundError();
  }

  const currentHold = holdRow as HoldRowWithMembers;
  // Authorization: only creator or elevated role may extend the hold
  if (!actorId) {
    throw new AssignTablesRpcError({
      message: 'Only the creator or elevated roles may extend holds',
      code: 'AUTH_FORBIDDEN',
      details: null,
      hint: null,
    });
  }
  if (currentHold.created_by && currentHold.created_by !== actorId) {
    try {
      const { data: membership } = await supabase
        .from('restaurant_memberships')
        .select('role')
        .eq('restaurant_id', currentHold.restaurant_id)
        .eq('user_id', actorId)
        .maybeSingle();
      const role = (membership as { role?: string } | null)?.role ?? null;
      const elevated = role && ['admin', 'manager', 'owner'].includes(role);
      if (!elevated) {
        throw new AssignTablesRpcError({
          message: 'Only the creator or elevated roles may extend holds',
          code: 'AUTH_FORBIDDEN',
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
        message: 'Only the creator or elevated roles may extend holds',
        code: 'AUTH_FORBIDDEN',
        details: null,
        hint: null,
      });
    }
  }
  const memberTableIds = extractTableIdsFromMembers(currentHold.table_hold_members ?? null);
  const currentExpires = DateTime.fromISO(currentHold.expires_at ?? '').toUTC();
  if (!currentExpires.isValid) {
    throw new HoldConflictError('Hold expiration timestamp invalid', holdId);
  }

  let targetExpiry: DateTime | null = null;
  if (typeof newExpiresAt === 'string') {
    const candidate = DateTime.fromISO(newExpiresAt).toUTC();
    if (candidate.isValid) {
      targetExpiry = candidate;
    }
  }

  if (!targetExpiry && typeof extendSeconds === 'number' && Number.isFinite(extendSeconds)) {
    targetExpiry = currentExpires.plus({ seconds: extendSeconds });
  }

  if (!targetExpiry || !targetExpiry.isValid) {
    throw new HoldConflictError('Cannot extend hold without a valid expiry', holdId);
  }

  if (targetExpiry <= currentExpires) {
    return normalizeHold(currentHold as Tables<'table_holds'>, memberTableIds);
  }

  const targetIso = targetExpiry.toUTC().toISO();
  const currentExpiresIso = currentExpires.toISO();
  if (!targetIso || !currentExpiresIso) {
    throw new HoldConflictError('Failed to normalize hold expiry', holdId);
  }
  const { data: updatedRow, error: updateError } = await supabase
    .from('table_holds')
    .update({
      expires_at: targetIso,
      updated_at: new Date().toISOString(),
    })
    .eq('id', holdId)
    .select('*, table_hold_members(table_id)')
    .maybeSingle();

  if (updateError || !updatedRow) {
    throw new HoldConflictError(updateError?.message ?? 'Failed to extend hold', holdId);
  }

  const updatedHold = updatedRow as HoldRowWithMembers;
  const updatedTableIds = extractTableIdsFromMembers(updatedHold.table_hold_members ?? null);

  const { emitHoldExtended } = await import('./telemetry');
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

  return normalizeHold(updatedHold as Tables<'table_holds'>, updatedTableIds);
}

export async function listActiveHoldsForBooking(input: ListActiveHoldsInput): Promise<TableHold[]> {
  const { bookingId, client } = input;
  const supabase = ensureClient(client);

  const { data, error } = await supabase
    .from('table_holds')
    .select('*, table_hold_members(table_id)')
    .eq('booking_id', bookingId)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    // Fail closed: a failed holds query must NOT be reported as "no active holds",
    // which would let an assignment proceed past a real hold and double-book. Mirror
    // findHoldConflicts (log + rethrow) instead of swallowing the error. (gap #1)
    console.error('[capacity.hold] listActiveHoldsForBooking query failed; failing closed', {
      bookingId,
      code: (error as { code?: string }).code ?? null,
      message: (error as { message?: string }).message ?? String(error),
    });
    throw error;
  }
  if (!data) {
    return [];
  }

  return data.map((row) => {
    const holdRow = row as HoldRowWithMembers;
    const memberTableIds = extractTableIdsFromMembers(holdRow.table_hold_members ?? null);
    return normalizeHold(holdRow, memberTableIds);
  });
}

export async function findHoldConflicts(
  input: FindHoldConflictsInput,
): Promise<HoldConflictInfo[]> {
  const { restaurantId, tableIds, startAt, endAt, excludeHoldId = null, client } = input;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    return [];
  }

  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);
  const nowIso = new Date().toISOString();
  const rangeLiteral = `[${startAt},${endAt})`;

  try {
    const { data, error } = await supabase
      .from('table_hold_windows')
      .select('hold_id, booking_id, restaurant_id, table_id, start_at, end_at, expires_at')
      .eq('restaurant_id', restaurantId)
      .gt('expires_at', nowIso)
      .in('table_id', tableIds)
      .filter('hold_window', 'ov', rangeLiteral);

    if (error) {
      const code = (error as { code?: string }).code;
      console.error(
        '[capacity.hold] hold_window query failed; strict conflict detection unavailable',
        {
          restaurantId,
          code: code ?? null,
          message: (error as { message?: string }).message ?? String(error),
        },
      );
      throw error;
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
    console.error('[capacity.hold] conflict evaluation failed (no fallback)', {
      restaurantId,
      code: code ?? null,
      message: (error as { message?: string }).message ?? String(error),
    });
    throw error;
  }
}

// Legacy confirmTableHold removed. See confirmHoldAssignment in tables.ts (allocator v2).

export async function sweepExpiredHolds(
  input?: SweepExpiredHoldsInput,
): Promise<SweepExpiredHoldsResult> {
  const { now, limit = 100, client } = input ?? {};
  const supabase = ensureClient(client);
  await configureHoldStrictConflictSession(supabase);
  const cutoff = now ?? new Date().toISOString();

  const { data, error } = await supabase
    .from('table_holds')
    .select('id')
    .lte('expires_at', cutoff)
    .order('expires_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('[capacity.hold] sweepExpiredHolds failed', {
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
  // Delete the parent hold rows FIRST. Conflict/availability reads start from
  // `table_holds` (joined with members), so removing the hold row first ensures a
  // concurrent reader never observes a hold that is still "active" but has had its
  // members already deleted (active-but-empty). Members are cleaned up afterward
  // (orphaned rows are also removed by the FK cascade if present).
  const { error: holdsDeleteError } = await supabase
    .from('table_holds')
    .delete()
    .in('id', holdIds);
  if (holdsDeleteError) {
    console.warn('[capacity.hold] sweepExpiredHolds failed to delete holds', {
      error: holdsDeleteError,
      cutoff,
      limit,
    });
    return {
      total: 0,
      holdIds: [],
    };
  }

  const { error: membersDeleteError } = await supabase
    .from('table_hold_members')
    .delete()
    .in('hold_id', holdIds);
  if (membersDeleteError) {
    // The holds are already gone, so they no longer appear active; surface the
    // residual member cleanup failure for observability but treat the sweep of the
    // (now-deleted) holds as completed.
    console.warn('[capacity.hold] sweepExpiredHolds failed to delete hold members', {
      error: membersDeleteError,
      cutoff,
      limit,
    });
  }

  return {
    total: holdIds.length,
    holdIds,
  };
}
