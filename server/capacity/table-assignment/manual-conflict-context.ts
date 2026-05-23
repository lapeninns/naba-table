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
  } catch {
    return [];
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
  } catch {
    return [];
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
  const holds = await listManualActiveHoldsForBooking({
    bookingId,
    client,
    enabled: holdsEnabled,
  });
  const conflicts = buildManualAssignmentConflicts({
    bookings: contextBookings,
    excludeHoldId,
    holds,
    policy,
    tableIds,
    targetBookingId: bookingId,
    window,
  });
  const holdConflicts = await findManualHoldConflicts({
    client,
    excludeHoldId,
    restaurantId,
    tableIds,
    window,
  });

  return {
    contextBookings,
    holds,
    conflicts,
    holdConflicts,
  };
}
