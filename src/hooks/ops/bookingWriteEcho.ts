import type { QueryClient } from '@tanstack/react-query';

/**
 * Realtime echo suppression for this client's own booking writes.
 *
 * A booking write (lifecycle, cancel, table change, edit) already updates the React Query caches
 * from the server's canonical response. The same write then comes back over Supabase realtime
 * (bookings, booking_history, booking_table_assignments, allocations) and each subscribed hook
 * would refetch its whole payload. These helpers let the realtime handlers skip events that are
 * the echo of a write this client has in flight, or has just applied.
 *
 * Trade-off: another user's change to the same booking inside the echo window is also skipped.
 * The dashboard safety poll and the next focus/reconnect refetch still pick it up.
 */

export const BOOKING_WRITE_ECHO_WINDOW_MS = 5_000;

type RecentBookingWrite = {
  at: number;
  status: string | null;
  updatedAt: string | null;
};

const registries = new WeakMap<QueryClient, Map<string, RecentBookingWrite>>();

function registryFor(queryClient: QueryClient): Map<string, RecentBookingWrite> {
  let registry = registries.get(queryClient);
  if (!registry) {
    registry = new Map();
    registries.set(queryClient, registry);
  }
  return registry;
}

/** The booking id a booking mutation's variables target (`bookingId`, or `id` for edits). */
export function bookingIdFromVariables(variables: unknown): string | null {
  if (!variables || typeof variables !== 'object') return null;
  const record = variables as Record<string, unknown>;
  if (typeof record.bookingId === 'string') return record.bookingId;
  if (typeof record.id === 'string') return record.id;
  return null;
}

/**
 * Mutations for this booking that are pending, including ones queued in its `booking:<id>`
 * scope. Inside a mutation's own `onMutate`/`onError` the count includes that mutation.
 */
export function countBookingWritesInFlight(queryClient: QueryClient, bookingId: string): number {
  return queryClient.isMutating({
    predicate: (mutation) => bookingIdFromVariables(mutation.state.variables) === bookingId,
  });
}

/** True while any mutation for this booking is pending (the floor-plan `isMutating` pattern). */
export function isBookingWriteInFlight(queryClient: QueryClient, bookingId: string): boolean {
  return countBookingWritesInFlight(queryClient, bookingId) > 0;
}

/** Records a write this client just applied, with the canonical status the server returned. */
export function recordBookingWrite(
  queryClient: QueryClient,
  bookingId: string,
  snapshot: { status?: string | null; updatedAt?: string | null } = {},
  now: number = Date.now(),
): void {
  const registry = registryFor(queryClient);
  registry.set(bookingId, {
    at: now,
    status: snapshot.status ?? null,
    updatedAt: snapshot.updatedAt ?? null,
  });
  // Keep the registry small: drop entries that can no longer match.
  for (const [id, entry] of registry) {
    if (now - entry.at > BOOKING_WRITE_ECHO_WINDOW_MS) registry.delete(id);
  }
}

type RealtimeRow = Record<string, unknown> | null | undefined;

function rowOf(payload: unknown, side: 'new' | 'old'): RealtimeRow {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>)[side];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringField(row: RealtimeRow, key: string): string | null {
  const value = row?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The booking a realtime payload is about: `id` on `bookings`, `booking_id` elsewhere. */
export function bookingIdFromRealtimePayload(table: string, payload: unknown): string | null {
  const key = table === 'bookings' ? 'id' : 'booking_id';
  return stringField(rowOf(payload, 'new'), key) ?? stringField(rowOf(payload, 'old'), key);
}

/**
 * True when a realtime event is the echo of this client's own write: a write for the booking is
 * in flight, or one was applied within the echo window and the event matches it.
 *
 * - `bookings` rows match on `updated_at` when both sides know it (a different `updated_at` is
 *   someone else's change, even with the same status), otherwise on `status`. A write that
 *   recorded neither (e.g. a table change whose status is unknown) suppresses no `bookings` event.
 * - Other tables (assignments, allocations, history) carry no version to compare, so any event
 *   for the booking inside the window is treated as the echo.
 *
 * Events that cannot be tied to a booking return false.
 */
export function isOwnBookingWriteEcho(
  queryClient: QueryClient,
  table: string,
  payload: unknown,
  now: number = Date.now(),
): boolean {
  const bookingId = bookingIdFromRealtimePayload(table, payload);
  if (!bookingId) return false;
  if (isBookingWriteInFlight(queryClient, bookingId)) return true;

  const recent = registries.get(queryClient)?.get(bookingId);
  if (!recent || now - recent.at > BOOKING_WRITE_ECHO_WINDOW_MS) return false;
  if (table !== 'bookings') return true;

  const row = rowOf(payload, 'new');
  const updatedAt = stringField(row, 'updated_at');
  if (recent.updatedAt && updatedAt) return recent.updatedAt === updatedAt;
  const status = stringField(row, 'status');
  if (recent.status && status) return recent.status === status;
  return false;
}
