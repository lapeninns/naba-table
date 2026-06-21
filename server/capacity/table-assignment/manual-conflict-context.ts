import {
  findHoldConflicts,
  listActiveHoldsForBooking,
  type HoldConflictInfo,
  type TableHold,
} from '@/server/capacity/holds';

import { buildBusyMaps, extractConflictsForTables } from './availability';
import { loadContextBookings, type ContextBookingRow, type DbClient } from './supabase';
import { type BookingWindow, type ManualAssignmentConflict } from './types';
import { toIsoUtc } from './utils';

import type { VenuePolicy } from '@/server/capacity/policy';

export type ManualWindowQuery = {
  startIso: string;
  endIso: string;
};

export type ManualValidationConflictContext = {
  contextBookings: ContextBookingRow[];
  holds: TableHold[];
  conflicts: ManualAssignmentConflict[];
  holdConflicts: HoldConflictInfo[];
  // False when a hold/conflict lookup could not be completed (DB error). Callers
  // pass this to buildManualChecks so detection is treated as unverified/blocking
  // rather than "no conflicts". (#8)
  holdLookupOk: boolean;
};

export function buildManualWindowQuery(window: BookingWindow): ManualWindowQuery {
  return {
    startIso: toIsoUtc(window.block.start) ?? '',
    endIso: toIsoUtc(window.block.end) ?? '',
  };
}

export function buildManualAssignmentConflicts({
  bookings,
  excludeHoldId,
  holds,
  policy,
  tableIds,
  targetBookingId,
  window,
}: {
  bookings: ContextBookingRow[];
  excludeHoldId?: string | null;
  holds: TableHold[];
  policy: VenuePolicy;
  tableIds: string[];
  targetBookingId: string;
  window: BookingWindow;
}): ManualAssignmentConflict[] {
  const busy = buildBusyMaps({
    targetBookingId,
    bookings,
    holds,
    excludeHoldId,
    policy,
    targetWindow: window,
  });

  return extractConflictsForTables(busy, tableIds, window);
}

export async function loadManualContextBookings({
  bookingDate,
  client,
  restaurantId,
  window,
}: {
  bookingDate: string | null;
  client: DbClient;
  restaurantId: string;
  window: BookingWindow;
}): Promise<ContextBookingRow[]> {
  return loadContextBookings(restaurantId, bookingDate, client, buildManualWindowQuery(window));
}

export async function listManualActiveHoldsForBooking({
  bookingId,
  client,
  enabled,
}: {
  bookingId: string;
  client: DbClient;
  enabled: boolean;
}): Promise<TableHold[]> {
  if (!enabled) {
    return [];
  }

  try {
    return await listActiveHoldsForBooking({ bookingId, client });
  } catch (error) {
    // Fail closed: a hold-lookup failure must NOT be reported as "no active holds",
    // which would let a manual assignment proceed onto a still-held table. Surface
    // it so confirmation is blocked rather than silently double-booking. (#20b)
    console.error('[capacity.manual] active hold lookup failed; blocking assignment', {
      bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function findManualHoldConflicts({
  client,
  excludeHoldId,
  restaurantId,
  tableIds,
  window,
}: {
  client: DbClient;
  excludeHoldId?: string | null;
  restaurantId: string;
  tableIds: string[];
  window: BookingWindow;
}): Promise<HoldConflictInfo[]> {
  try {
    return await findHoldConflicts({
      restaurantId,
      tableIds,
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
      excludeHoldId,
      client,
    });
  } catch (error) {
    // Fail closed: swallowing a hold-conflict lookup error as "no conflicts" can
    // double-book a table whose hold lookup transiently failed. Surface it so the
    // manual selection check blocks instead of passing. (#1)
    console.error('[capacity.manual] hold conflict lookup failed; blocking assignment', {
      restaurantId,
      tableIds,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function loadManualValidationConflictContext({
  bookingDate,
  bookingId,
  client,
  excludeHoldId,
  holdsEnabled,
  policy,
  restaurantId,
  tableIds,
  window,
}: {
  bookingDate: string | null;
  bookingId: string;
  client: DbClient;
  excludeHoldId?: string | null;
  holdsEnabled: boolean;
  policy: VenuePolicy;
  restaurantId: string;
  tableIds: string[];
  window: BookingWindow;
}): Promise<ManualValidationConflictContext> {
  const contextBookings = await loadManualContextBookings({
    bookingDate,
    client,
    restaurantId,
    window,
  });
  // Hold lookups fail CLOSED: if either throws we degrade gracefully here and let
  // buildManualChecks block on `holdLookupOk: false` (an "unable to verify holds"
  // error) rather than letting the raw error abort the whole validation. The
  // lookups still log before throwing, so observability is preserved. (#8)
  let holdLookupOk = true;
  let holds: TableHold[] = [];
  try {
    holds = await listManualActiveHoldsForBooking({
      bookingId,
      client,
      enabled: holdsEnabled,
    });
  } catch {
    holdLookupOk = false;
  }

  const conflicts = buildManualAssignmentConflicts({
    bookings: contextBookings,
    excludeHoldId,
    holds,
    policy,
    tableIds,
    targetBookingId: bookingId,
    window,
  });

  let holdConflicts: HoldConflictInfo[] = [];
  try {
    holdConflicts = await findManualHoldConflicts({
      client,
      excludeHoldId,
      restaurantId,
      tableIds,
      window,
    });
  } catch {
    holdLookupOk = false;
  }

  return {
    contextBookings,
    holds,
    conflicts,
    holdConflicts,
    holdLookupOk,
  };
}
