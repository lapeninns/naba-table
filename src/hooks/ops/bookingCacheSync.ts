import { queryKeys } from '@/lib/query/keys';
import { patchDashboardSummaryBooking } from '@/utils/ops/dashboardSummary';

import { countBookingWritesInFlight, recordBookingWrite } from './bookingWriteEcho';

import type {
  AssignmentContext,
  OpsBookingDialogBundle,
  ManualAssignmentTable,
} from '@/services/ops/bookings';
import type { ListTablesResult } from '@/services/ops/tables';
import type {
  OpsBookingListItem,
  OpsBookingsPage,
  OpsBookingStatus,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
} from '@/types/ops';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Per-booking cache sync for ops booking writes (contract C5).
 *
 * One booking appears in several caches: every dashboard summary date that contains it (the
 * dashboard, the floor plan and the booking dialog can each hold a different date key), the
 * bookings list pages (plain and infinite), the detail entry, the dialog bundle and the
 * assignment context. Writes patch only this booking's slice in each of them, from the server's
 * canonical response, instead of refetching whole payloads. Rollback is per booking too, so a
 * failure never wipes concurrent changes to other bookings.
 */

export type TableAssignmentGroups = OpsTodayBooking['tableAssignments'];

export type BookingRowPatch = {
  status?: OpsBookingStatus;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  tableAssignments?: TableAssignmentGroups;
};

type BookingRowFields = {
  status: OpsBookingStatus;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  tableAssignments?: TableAssignmentGroups;
  requiresTableAssignment?: boolean;
};

const INACTIVE_FOR_ASSIGNMENT = new Set<OpsBookingStatus>(['cancelled', 'no_show']);

function applyPatch<T extends BookingRowFields>(row: T, patch: BookingRowPatch): T {
  const next: T = { ...row };
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.checkedInAt !== undefined) next.checkedInAt = patch.checkedInAt;
  if (patch.checkedOutAt !== undefined) next.checkedOutAt = patch.checkedOutAt;
  if (patch.tableAssignments !== undefined) next.tableAssignments = patch.tableAssignments;
  if (patch.tableAssignments !== undefined || patch.status !== undefined) {
    const groups = next.tableAssignments ?? [];
    if ('requiresTableAssignment' in row || patch.tableAssignments !== undefined) {
      next.requiresTableAssignment =
        groups.length === 0 && !INACTIVE_FOR_ASSIGNMENT.has(next.status);
    }
  }
  return next;
}

function pickFields(row: BookingRowFields): BookingRowFields {
  const picked: BookingRowFields = { status: row.status };
  if ('checkedInAt' in row) picked.checkedInAt = row.checkedInAt ?? null;
  if ('checkedOutAt' in row) picked.checkedOutAt = row.checkedOutAt ?? null;
  if ('tableAssignments' in row) picked.tableAssignments = row.tableAssignments;
  if ('requiresTableAssignment' in row)
    picked.requiresTableAssignment = row.requiresTableAssignment;
  return picked;
}

export function tableIdsOf(groups: TableAssignmentGroups | undefined): string[] {
  return [...new Set((groups ?? []).flatMap((group) => group.members.map((m) => m.tableId)))];
}

// ---------------------------------------------------------------------------
// Cache key predicates
// ---------------------------------------------------------------------------

function isSummaryKey(queryKey: QueryKey, restaurantId?: string | null): boolean {
  return (
    queryKey[0] === 'ops' &&
    queryKey[1] === 'dashboard' &&
    queryKey[3] === 'summary' &&
    typeof queryKey[2] === 'string' &&
    (!restaurantId || queryKey[2] === restaurantId)
  );
}

function hasSummaryBookings(value: unknown): value is OpsTodayBookingsSummary {
  return Boolean(value && Array.isArray((value as OpsTodayBookingsSummary).bookings));
}

function isInfiniteList(value: unknown): value is InfiniteData<OpsBookingsPage> {
  return Boolean(value && Array.isArray((value as InfiniteData<OpsBookingsPage>).pages));
}

function isListPage(value: unknown): value is OpsBookingsPage {
  return Boolean(value && Array.isArray((value as OpsBookingsPage).items));
}

/**
 * Whether a bookings list query (`opsBookings.list(params)`) still shows a booking with this
 * status. The list endpoint filters by `status` (single) or `statuses` (comma separated).
 */
export function listAcceptsStatus(queryKey: QueryKey, status: OpsBookingStatus): boolean {
  const params = queryKey[3];
  if (!params || typeof params !== 'object') return true;
  const record = params as Record<string, unknown>;
  if (typeof record.status === 'string' && record.status !== 'all') {
    return record.status === status;
  }
  if (typeof record.statuses === 'string' && record.statuses.length > 0) {
    return record.statuses.split(',').includes(status);
  }
  if (Array.isArray(record.statuses) && record.statuses.length > 0) {
    return record.statuses.includes(status);
  }
  return true;
}

type ListData = OpsBookingsPage | InfiniteData<OpsBookingsPage>;

function mapListItems(
  data: ListData,
  bookingId: string,
  map: (item: OpsBookingListItem) => OpsBookingListItem | null,
): ListData {
  const mapPage = (page: OpsBookingsPage): OpsBookingsPage => {
    let changed = false;
    let removed = 0;
    const items: OpsBookingListItem[] = [];
    for (const item of page.items) {
      if (item.id !== bookingId) {
        items.push(item);
        continue;
      }
      changed = true;
      const next = map(item);
      if (next) items.push(next);
      else removed += 1;
    }
    if (!changed) return page;
    return removed > 0
      ? {
          ...page,
          items,
          pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - removed) },
        }
      : { ...page, items };
  };

  if (isInfiniteList(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      const next = mapPage(page);
      if (next !== page) changed = true;
      return next;
    });
    if (!changed) return data;
    // Keep the first page's total in step when a later page lost the row.
    const removedTotal = data.pages.reduce(
      (sum, page, index) => sum + (page.items.length - pages[index].items.length),
      0,
    );
    if (removedTotal > 0 && pages[0] === data.pages[0] && pages[0]) {
      pages[0] = {
        ...pages[0],
        pageInfo: {
          ...pages[0].pageInfo,
          total: Math.max(0, pages[0].pageInfo.total - removedTotal),
        },
      };
    }
    return { ...data, pages };
  }
  return mapPage(data as OpsBookingsPage);
}

function findListItem(data: unknown, bookingId: string): OpsBookingListItem | null {
  if (isInfiniteList(data)) {
    for (const page of data.pages) {
      const match = page.items.find((item) => item.id === bookingId);
      if (match) return match;
    }
    return null;
  }
  if (isListPage(data)) return data.items.find((item) => item.id === bookingId) ?? null;
  return null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type BookingCacheRow = {
  status: OpsBookingStatus;
  customerName: string | null;
  startTime: string | null;
  endTime: string | null;
  tableAssignments: TableAssignmentGroups;
  restaurantId: string | null;
};

/** The booking's current row from whichever cache has it (summaries first). */
export function readBookingRow(
  queryClient: QueryClient,
  bookingId: string,
): BookingCacheRow | null {
  for (const [queryKey, data] of queryClient.getQueriesData<OpsTodayBookingsSummary>({
    predicate: (query) => isSummaryKey(query.queryKey),
  })) {
    if (!hasSummaryBookings(data)) continue;
    const row = data.bookings.find((booking) => booking.id === bookingId);
    if (row) {
      return {
        status: row.status,
        customerName: row.customerName ?? null,
        startTime: row.startTime ?? null,
        endTime: row.endTime ?? null,
        tableAssignments: row.tableAssignments ?? [],
        restaurantId: typeof queryKey[2] === 'string' ? queryKey[2] : null,
      };
    }
  }
  const fromList = (): OpsBookingListItem | null => {
    for (const [, data] of queryClient.getQueriesData({
      queryKey: queryKeys.opsBookings.listPrefix(),
    })) {
      const match = findListItem(data, bookingId);
      if (match) return match;
    }
    return null;
  };
  const item =
    queryClient.getQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail(bookingId)) ??
    queryClient.getQueryData<OpsBookingDialogBundle>(queryKeys.opsBookings.dialog(bookingId))
      ?.booking ??
    fromList();
  if (!item) return null;
  return {
    status: item.status,
    customerName: item.customerName ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    tableAssignments: item.tableAssignments ?? [],
    restaurantId: item.restaurantId ?? null,
  };
}

type TableInfo = { tableNumber: string; capacity: number | null; section: string | null };

/** Table number/capacity lookups from every cache that knows the restaurant's tables. */
export function readTableInfo(
  queryClient: QueryClient,
  restaurantId: string | null,
  bookingId: string,
): Map<string, TableInfo> {
  const info = new Map<string, TableInfo>();
  const addTables = (tables: readonly ManualAssignmentTable[] | undefined) => {
    for (const table of tables ?? []) {
      info.set(table.id, {
        tableNumber: table.tableNumber,
        capacity: table.capacity ?? null,
        section: table.section ?? null,
      });
    }
  };
  addTables(
    queryClient.getQueryData<AssignmentContext>(queryKeys.opsBookings.assignmentContext(bookingId))
      ?.tables,
  );
  addTables(
    queryClient.getQueryData<OpsBookingDialogBundle>(queryKeys.opsBookings.dialog(bookingId))
      ?.assignmentContext?.tables,
  );
  if (restaurantId) {
    const list = queryClient.getQueryData<ListTablesResult>(queryKeys.opsTables.list(restaurantId));
    for (const table of list?.tables ?? []) {
      if (!info.has(table.id)) {
        info.set(table.id, {
          tableNumber: table.tableNumber,
          capacity: table.capacity ?? null,
          section: table.section ?? null,
        });
      }
    }
  }
  const row = readBookingRow(queryClient, bookingId);
  for (const group of row?.tableAssignments ?? []) {
    for (const member of group.members) {
      if (!info.has(member.tableId)) {
        info.set(member.tableId, {
          tableNumber: member.tableNumber,
          capacity: member.capacity,
          section: member.section,
        });
      }
    }
  }
  return info;
}

/**
 * Builds assignment groups for table ids from cached table data. `complete` is false when a
 * table could not be resolved (its number shows as '?'), so the caller can revalidate.
 */
export function buildTableAssignments(
  queryClient: QueryClient,
  restaurantId: string | null,
  bookingId: string,
  tableIds: readonly string[],
): { groups: TableAssignmentGroups; complete: boolean } {
  const info = readTableInfo(queryClient, restaurantId, bookingId);
  let complete = true;
  const groups = [...new Set(tableIds)].map((tableId) => {
    const table = info.get(tableId);
    if (!table) complete = false;
    return {
      groupId: null,
      capacitySum: table?.capacity ?? null,
      members: [
        {
          tableId,
          tableNumber: table?.tableNumber ?? '?',
          capacity: table?.capacity ?? null,
          section: table?.section ?? null,
        },
      ],
    };
  });
  return { groups, complete };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type PatchBookingCachesOptions = {
  /** Limit summary patches to one restaurant. */
  restaurantId?: string | null;
  /**
   * Drop the booking from list pages whose status filter no longer matches, and mark the other
   * lists stale (without refetching) so a list that should now include it reloads next time it
   * is shown. Use it with canonical server data, not for optimistic updates.
   */
  pruneLists?: boolean;
};

/** Applies a patch to this booking in every cache that holds it. */
export function patchBookingCaches(
  queryClient: QueryClient,
  bookingId: string,
  patch: BookingRowPatch,
  options: PatchBookingCachesOptions = {},
): void {
  queryClient.setQueriesData<OpsTodayBookingsSummary>(
    { predicate: (query) => isSummaryKey(query.queryKey, options.restaurantId) },
    (current) =>
      hasSummaryBookings(current)
        ? patchDashboardSummaryBooking(current, bookingId, (row) => applyPatch(row, patch))
        : current,
  );

  queryClient.setQueryData<OpsBookingListItem>(
    queryKeys.opsBookings.detail(bookingId),
    (current) => (current ? applyPatch(current, patch) : current),
  );

  const nextTableIds = patch.tableAssignments ? tableIdsOf(patch.tableAssignments) : null;
  queryClient.setQueryData<OpsBookingDialogBundle>(
    queryKeys.opsBookings.dialog(bookingId),
    (current) => {
      if (!current) return current;
      const assignmentContext =
        nextTableIds || patch.status
          ? {
              ...current.assignmentContext,
              booking: current.assignmentContext.booking
                ? {
                    ...current.assignmentContext.booking,
                    status: patch.status ?? current.assignmentContext.booking.status,
                  }
                : current.assignmentContext.booking,
              bookingAssignments: nextTableIds ?? current.assignmentContext.bookingAssignments,
            }
          : current.assignmentContext;
      return { ...current, booking: applyPatch(current.booking, patch), assignmentContext };
    },
  );

  if (nextTableIds || patch.status) {
    queryClient.setQueryData<AssignmentContext>(
      queryKeys.opsBookings.assignmentContext(bookingId),
      (current) =>
        current
          ? {
              ...current,
              booking: current.booking
                ? { ...current.booking, status: patch.status ?? current.booking.status }
                : current.booking,
              bookingAssignments: nextTableIds ?? current.bookingAssignments,
            }
          : current,
    );
  }

  let changedListMembership = false;
  for (const [queryKey, data] of queryClient.getQueriesData<ListData>({
    queryKey: queryKeys.opsBookings.listPrefix(),
  })) {
    if (!isInfiniteList(data) && !isListPage(data)) continue;
    const existing = findListItem(data, bookingId);
    if (!existing) {
      if (options.pruneLists && patch.status && listAcceptsStatus(queryKey, patch.status)) {
        changedListMembership = true;
      }
      continue;
    }
    const next = mapListItems(data, bookingId, (item) => {
      const patched = applyPatch(item, patch);
      if (options.pruneLists && !listAcceptsStatus(queryKey, patched.status)) return null;
      return patched;
    });
    if (next !== data) queryClient.setQueryData(queryKey, next);
  }
  if (changedListMembership) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.opsBookings.listPrefix(),
      refetchType: 'none',
    });
  }
}

type SnapshotEntry =
  | { kind: 'summary'; queryKey: QueryKey; fields: BookingRowFields }
  | { kind: 'list'; queryKey: QueryKey; fields: BookingRowFields }
  | { kind: 'detail'; fields: BookingRowFields }
  | { kind: 'dialog'; fields: BookingRowFields; bookingAssignments: string[] | null }
  | {
      kind: 'assignmentContext';
      bookingAssignments: string[];
      status: AssignmentContext['booking']['status'] | null;
    };

export type BookingCacheSnapshot = {
  bookingId: string;
  entries: SnapshotEntry[];
};

/** Captures this booking's slice in every cache, for a per-booking rollback. */
export function snapshotBookingCaches(
  queryClient: QueryClient,
  bookingId: string,
): BookingCacheSnapshot {
  const entries: SnapshotEntry[] = [];
  for (const [queryKey, data] of queryClient.getQueriesData<OpsTodayBookingsSummary>({
    predicate: (query) => isSummaryKey(query.queryKey),
  })) {
    if (!hasSummaryBookings(data)) continue;
    const row = data.bookings.find((booking) => booking.id === bookingId);
    if (row) entries.push({ kind: 'summary', queryKey, fields: pickFields(row) });
  }
  for (const [queryKey, data] of queryClient.getQueriesData({
    queryKey: queryKeys.opsBookings.listPrefix(),
  })) {
    const item = findListItem(data, bookingId);
    if (item) entries.push({ kind: 'list', queryKey, fields: pickFields(item) });
  }
  const detail = queryClient.getQueryData<OpsBookingListItem>(
    queryKeys.opsBookings.detail(bookingId),
  );
  if (detail) entries.push({ kind: 'detail', fields: pickFields(detail) });
  const bundle = queryClient.getQueryData<OpsBookingDialogBundle>(
    queryKeys.opsBookings.dialog(bookingId),
  );
  if (bundle) {
    entries.push({
      kind: 'dialog',
      fields: pickFields(bundle.booking),
      bookingAssignments: bundle.assignmentContext?.bookingAssignments ?? null,
    });
  }
  const context = queryClient.getQueryData<AssignmentContext>(
    queryKeys.opsBookings.assignmentContext(bookingId),
  );
  if (context) {
    entries.push({
      kind: 'assignmentContext',
      bookingAssignments: context.bookingAssignments,
      status: context.booking?.status ?? null,
    });
  }
  return { bookingId, entries };
}

function restoreFields<T extends BookingRowFields>(row: T, fields: BookingRowFields): T {
  return { ...row, ...fields };
}

/** Restores the booking's slice captured by `snapshotBookingCaches`, leaving other rows alone. */
export function restoreBookingCaches(
  queryClient: QueryClient,
  snapshot: BookingCacheSnapshot,
): void {
  const { bookingId } = snapshot;
  for (const entry of snapshot.entries) {
    switch (entry.kind) {
      case 'summary':
        queryClient.setQueryData<OpsTodayBookingsSummary>(entry.queryKey, (current) =>
          hasSummaryBookings(current)
            ? patchDashboardSummaryBooking(current, bookingId, (row) =>
                restoreFields(row, entry.fields),
              )
            : current,
        );
        break;
      case 'list':
        queryClient.setQueryData<ListData>(entry.queryKey, (current) =>
          current && (isInfiniteList(current) || isListPage(current))
            ? mapListItems(current, bookingId, (item) => restoreFields(item, entry.fields))
            : current,
        );
        break;
      case 'detail':
        queryClient.setQueryData<OpsBookingListItem>(
          queryKeys.opsBookings.detail(bookingId),
          (current) => (current ? restoreFields(current, entry.fields) : current),
        );
        break;
      case 'dialog':
        queryClient.setQueryData<OpsBookingDialogBundle>(
          queryKeys.opsBookings.dialog(bookingId),
          (current) =>
            current
              ? {
                  ...current,
                  booking: restoreFields(current.booking, entry.fields),
                  assignmentContext:
                    entry.bookingAssignments && current.assignmentContext
                      ? {
                          ...current.assignmentContext,
                          bookingAssignments: entry.bookingAssignments,
                        }
                      : current.assignmentContext,
                }
              : current,
        );
        break;
      case 'assignmentContext':
        queryClient.setQueryData<AssignmentContext>(
          queryKeys.opsBookings.assignmentContext(bookingId),
          (current) =>
            current
              ? {
                  ...current,
                  bookingAssignments: entry.bookingAssignments,
                  booking:
                    current.booking && entry.status
                      ? { ...current.booking, status: entry.status }
                      : current.booking,
                }
              : current,
        );
        break;
    }
  }
}

/** Cancels in-flight fetches that would overwrite an optimistic patch of this booking. */
export async function cancelBookingQueries(
  queryClient: QueryClient,
  bookingId: string,
  restaurantId?: string | null,
): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ predicate: (query) => isSummaryKey(query.queryKey, restaurantId) }),
    queryClient.cancelQueries({ queryKey: queryKeys.opsBookings.detail(bookingId) }),
    queryClient.cancelQueries({ queryKey: queryKeys.opsBookings.dialog(bookingId) }),
    queryClient.cancelQueries({ queryKey: queryKeys.opsBookings.listPrefix() }),
  ]);
}

/** Summary dates in cache for a restaurant, by `booking_date`, for narrow invalidation. */
export function summaryKeysFor(queryClient: QueryClient, restaurantId: string): QueryKey[] {
  return queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isSummaryKey(query.queryKey, restaurantId) })
    .map((query) => query.queryKey);
}

/**
 * Writes a canonical `OpsBookingListItem` (e.g. the PATCH response) into the detail, dialog
 * bundle and list caches. Summary rows have a different shape; callers invalidate the affected
 * summary dates instead (see `summaryKeysContaining`).
 *
 * `omit` drops fields the response does not carry reliably (an edit's PATCH response has no
 * table assignments, although the edit may have released or re-assigned tables), so the cached
 * values are kept until the caller's revalidation replaces them. With `pruneLists`, the row is
 * removed from list pages whose status filter no longer matches.
 *
 * Returns the list query keys that still hold the booking after the write.
 */
export function writeBookingListItem(
  queryClient: QueryClient,
  item: OpsBookingListItem,
  options: { omit?: readonly (keyof OpsBookingListItem)[]; pruneLists?: boolean } = {},
): QueryKey[] {
  const patch: Partial<OpsBookingListItem> = { ...item };
  for (const key of options.omit ?? []) delete patch[key];
  queryClient.setQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail(item.id), (current) =>
    current ? { ...current, ...patch } : item,
  );
  queryClient.setQueryData<OpsBookingDialogBundle>(queryKeys.opsBookings.dialog(item.id), (current) =>
    current ? { ...current, booking: { ...current.booking, ...patch } } : current,
  );
  const holding: QueryKey[] = [];
  for (const [queryKey, data] of queryClient.getQueriesData<ListData>({
    queryKey: queryKeys.opsBookings.listPrefix(),
  })) {
    if (!isInfiniteList(data) && !isListPage(data)) continue;
    if (!findListItem(data, item.id)) continue;
    const keep = !options.pruneLists || !item.status || listAcceptsStatus(queryKey, item.status);
    queryClient.setQueryData(
      queryKey,
      mapListItems(data, item.id, (current) => (keep ? { ...current, ...patch } : null)),
    );
    if (keep) holding.push(queryKey);
  }
  return holding;
}

/**
 * Summary queries for a restaurant that show this booking now, or whose date is one of `dates`
 * (a summary's payload carries its resolved date, so the 'today' key matches too).
 */
export function summaryKeysContaining(
  queryClient: QueryClient,
  restaurantId: string | null,
  bookingId: string,
  dates: readonly (string | null | undefined)[],
): QueryKey[] {
  const wanted = new Set(dates.filter((date): date is string => Boolean(date)));
  return queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isSummaryKey(query.queryKey, restaurantId) })
    .filter((query) => {
      const data = query.state.data;
      if (!hasSummaryBookings(data)) return false;
      if (data.date && wanted.has(data.date)) return true;
      return data.bookings.some((booking) => booking.id === bookingId);
    })
    .map((query) => query.queryKey);
}

/**
 * After a 409 the booking changed elsewhere: take the server's status when the error carries it,
 * then refetch this one booking and patch its row everywhere (no summary or list refetch).
 */
export async function refreshBookingAfterConflict(
  queryClient: QueryClient,
  params: {
    bookingId: string;
    restaurantId: string | null;
    currentStatus: OpsBookingStatus | null;
    fetchBooking: () => Promise<OpsBookingListItem>;
  },
): Promise<void> {
  const { bookingId, restaurantId, currentStatus, fetchBooking } = params;
  if (currentStatus) {
    patchBookingCaches(queryClient, bookingId, { status: currentStatus }, {
      restaurantId,
      pruneLists: true,
    });
  }
  try {
    const fresh = await queryClient.fetchQuery<OpsBookingListItem>({
      queryKey: queryKeys.opsBookings.detail(bookingId),
      queryFn: fetchBooking,
      staleTime: 0,
    });
    const patch: BookingRowPatch = { status: fresh.status };
    if (fresh.checkedInAt !== undefined) patch.checkedInAt = fresh.checkedInAt;
    if (fresh.checkedOutAt !== undefined) patch.checkedOutAt = fresh.checkedOutAt;
    if (fresh.tableAssignments) patch.tableAssignments = fresh.tableAssignments;
    patchBookingCaches(queryClient, bookingId, patch, { restaurantId, pruneLists: true });
    recordBookingWrite(queryClient, bookingId, { status: fresh.status });
  } catch {
    // The error toast already told the user; the next realtime event or poll catches up.
  }
}

// ---------------------------------------------------------------------------
// Rollback for writes that share a booking scope
// ---------------------------------------------------------------------------

/**
 * A booking write's rollback point. TanStack runs `onMutate` as soon as a mutation is created,
 * before it waits for its scope, so a write queued behind another write on the same booking
 * snapshots that write's optimistic state. `queuedBehind` records that case: such a snapshot is
 * not the server state and must not be restored blindly.
 */
export type BookingRollback = { snapshot: BookingCacheSnapshot; queuedBehind: boolean };

/** Call from `onMutate`, before the optimistic patch. */
export function captureBookingRollback(
  queryClient: QueryClient,
  bookingId: string,
): BookingRollback {
  return {
    snapshot: snapshotBookingCaches(queryClient, bookingId),
    // The count includes this mutation, which is already pending when `onMutate` runs.
    queuedBehind: countBookingWritesInFlight(queryClient, bookingId) > 1,
  };
}

/**
 * Call from `onError`. Returns what happened:
 * - `deferred`: another write for the booking is still pending or queued; it snapshotted this
 *   write's optimistic state and settles the booking itself, so nothing is restored now.
 * - `restored`: the snapshot was the pre-write state and has been put back.
 * - `refresh`: the snapshot included an earlier write whose outcome is unknown to it; the caller
 *   must refresh the booking from the server (`refreshBookingAfterConflict`).
 */
export function rollbackBookingWrite(
  queryClient: QueryClient,
  rollback: BookingRollback,
): 'deferred' | 'restored' | 'refresh' {
  const { snapshot, queuedBehind } = rollback;
  if (countBookingWritesInFlight(queryClient, snapshot.bookingId) > 1) return 'deferred';
  if (queuedBehind) return 'refresh';
  restoreBookingCaches(queryClient, snapshot);
  return 'restored';
}
