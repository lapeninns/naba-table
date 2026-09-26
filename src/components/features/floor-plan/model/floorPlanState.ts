import { distance } from './floorPlanLayout';
import { MINUTE_MS, formatClock, formatDuration, minutesBetween } from './floorPlanTime';

import type { FloorPlanLayout } from './floorPlanLayout';
import type {
  FloorBooking,
  FloorHold,
  FloorPlanSnapshot,
  FloorService,
  FloorServiceFilter,
  FloorTable,
} from './floorPlanTypes';
import type { OpsBookingStatus } from '@/types/ops';

/** Mirrors the allocator's join limit (getAllocatorKMax). */
export const MAX_JOINED_TABLES = 5;
const DUE_SOON_MS = 30 * MINUTE_MS;
const NOW_TOLERANCE_MS = 5 * MINUTE_MS;
const LIVE_OVERRUN_MS = 15 * MINUTE_MS;
const ARRIVING_WINDOW_MS = 45 * MINUTE_MS;
const NO_SHOW_GRACE_MS = 15 * MINUTE_MS;
const CHECK_IN_LEAD_MS = 90 * MINUTE_MS;

const INACTIVE_STATUSES: ReadonlySet<OpsBookingStatus> = new Set(['cancelled', 'no_show']);
const FINAL_STATUSES: ReadonlySet<OpsBookingStatus> = new Set([
  'cancelled',
  'no_show',
  'completed',
]);
const NEEDS_TABLE_STATUSES: ReadonlySet<OpsBookingStatus> = new Set([
  'pending',
  'pending_allocation',
  'confirmed',
]);

export type TableStateKind =
  | 'free'
  | 'due'
  | 'late'
  | 'seated'
  | 'over'
  | 'booked'
  | 'held'
  | 'out_of_service'
  | 'saving';

export type TableState = {
  kind: TableStateKind;
  /** Full label, e.g. "Seated 45m". */
  text: string;
  /** Compact label for small zoom levels. */
  short: string;
  sub: string;
  booking: FloorBooking | null;
};

/** One optimistic assignment change the UI is waiting on. */
export type PendingAssignment = {
  bookingId: string;
  kind: 'assign' | 'move' | 'unassign';
  tableIds: string[];
  previousTableIds: string[];
};

export type ServiceContext = {
  nowMs: number;
  /** The time the plan is showing (scrubber). */
  atMs: number;
  /** Today's date in the restaurant's timezone. */
  today: string;
  timezone: string;
};

export type FitResult =
  | { ok: true; tableIds: string[]; label: string; join: boolean; seats: number }
  | { ok: false; reason: string };

export function isLiveDate(
  snapshot: Pick<FloorPlanSnapshot, 'date'>,
  ctx: ServiceContext,
): boolean {
  return snapshot.date === ctx.today;
}

export function isShowingNow(
  snapshot: Pick<FloorPlanSnapshot, 'date'>,
  ctx: ServiceContext,
): boolean {
  return isLiveDate(snapshot, ctx) && Math.abs(ctx.atMs - ctx.nowMs) < NOW_TOLERANCE_MS;
}

/** Past dates, and earlier times today, are view-only. */
export function isReadOnly(
  snapshot: Pick<FloorPlanSnapshot, 'date'>,
  ctx: ServiceContext,
): boolean {
  if (snapshot.date < ctx.today) return true;
  return isLiveDate(snapshot, ctx) && ctx.atMs < ctx.nowMs - 4 * MINUTE_MS;
}

export function isPlanningDate(
  snapshot: Pick<FloorPlanSnapshot, 'date'>,
  ctx: ServiceContext,
): boolean {
  return snapshot.date > ctx.today;
}

/** When a booking actually holds its table(s). */
export function occupancy(
  booking: FloorBooking,
  ctx: ServiceContext,
  live: boolean,
): [number, number] {
  if (booking.status === 'checked_in') {
    const checkedIn = booking.checkedInAtMs ?? booking.startMs;
    // The check-in time comes from the server clock; never let skew hide a party that is seated now.
    const start = live ? Math.min(checkedIn, ctx.nowMs) : checkedIn;
    const end = live ? Math.max(booking.endMs, ctx.nowMs + LIVE_OVERRUN_MS) : booking.endMs;
    return [start, end];
  }
  if (booking.status === 'completed') {
    const checkedOut = booking.checkedOutAtMs ?? booking.endMs;
    // Completed means the table is free now, whatever the server clock said.
    return [booking.checkedInAtMs ?? booking.startMs, live ? Math.min(checkedOut, ctx.nowMs) : checkedOut];
  }
  return [booking.startMs, booking.endMs];
}

/** Window used for conflict checks: the allocator block for upcoming bookings. */
function busyWindow(booking: FloorBooking, ctx: ServiceContext, live: boolean): [number, number] {
  if (booking.status === 'checked_in' || booking.status === 'completed') {
    return occupancy(booking, ctx, live);
  }
  return [
    Math.min(booking.blockStartMs, booking.startMs),
    Math.max(booking.blockEndMs, booking.endMs),
  ];
}

export function bookingsOnTable(snapshot: FloorPlanSnapshot, tableId: string): FloorBooking[] {
  return snapshot.bookings
    .filter((b) => b.tableIds.includes(tableId) && !INACTIVE_STATUSES.has(b.status))
    .sort((a, b) => a.startMs - b.startMs);
}

function holdAt(holds: FloorHold[], tableId: string, atMs: number): FloorHold | undefined {
  return holds.find((h) => h.tableId === tableId && h.startMs <= atMs && atMs < h.endMs);
}

export function tableStateAt(
  snapshot: FloorPlanSnapshot,
  table: FloorTable,
  ctx: ServiceContext,
  pending: readonly PendingAssignment[] = [],
): TableState {
  const tz = ctx.timezone;
  const live = isLiveDate(snapshot, ctx);
  const now = isShowingNow(snapshot, ctx);
  const t = ctx.atMs;

  for (const change of pending) {
    if (change.tableIds.includes(table.id)) {
      const booking = snapshot.bookings.find((b) => b.id === change.bookingId) ?? null;
      const text = change.kind === 'move' ? 'Moving here…' : 'Assigning…';
      return { kind: 'saving', text, short: 'Saving', sub: booking?.name ?? '', booking };
    }
    if (change.previousTableIds.includes(table.id)) {
      return { kind: 'saving', text: 'Updating…', short: 'Saving', sub: '', booking: null };
    }
  }

  if (table.outOfService) {
    return { kind: 'out_of_service', text: 'Out of service', short: 'Off', sub: '', booking: null };
  }

  const onTable = bookingsOnTable(snapshot, table.id);
  const next = onTable.find(
    (b) => b.startMs > t && b.status !== 'completed' && b.status !== 'checked_in',
  );
  const current = onTable.find((b) => {
    const [a, z] = occupancy(b, ctx, live);
    return a <= t && t < z;
  });

  if (current) {
    const end = current.endMs;
    if (current.status === 'checked_in' || current.status === 'completed') {
      if (current.status === 'checked_in' && now && ctx.nowMs >= end) {
        const over = minutesBetween(end, ctx.nowMs);
        return {
          kind: 'over',
          text: `Over ${over}m`,
          short: `+${over}m`,
          sub: next ? `Next ${formatClock(next.startMs, tz)}` : `Due out ${formatClock(end, tz)}`,
          booking: current,
        };
      }
      if (current.status === 'checked_in' && t > ctx.nowMs) {
        return {
          kind: 'seated',
          text: 'Seated',
          short: 'Seated',
          sub: `Ends ${formatClock(end, tz)}`,
          booking: current,
        };
      }
      const seatedFor = formatDuration(t - (current.checkedInAtMs ?? current.startMs));
      return {
        kind: 'seated',
        text: `Seated ${seatedFor}`,
        short: seatedFor,
        sub: `Ends ${formatClock(end, tz)}`,
        booking: current,
      };
    }
    if (live && t <= ctx.nowMs + 4 * MINUTE_MS) {
      const late = Math.max(0, minutesBetween(current.startMs, t));
      return {
        kind: 'late',
        text: `Due ${formatClock(current.startMs, tz)} · ${current.partySize}`,
        short: `Late ${late}m`,
        sub: `Late ${late}m`,
        booking: current,
      };
    }
    return {
      kind: 'booked',
      text: `Booked · ${current.partySize}`,
      short: 'Booked',
      sub: `Until ${formatClock(end, tz)}`,
      booking: current,
    };
  }

  const hold = holdAt(snapshot.holds, table.id, t);
  if (hold) {
    return {
      kind: 'held',
      text: 'Held',
      short: 'Held',
      sub: `Until ${formatClock(hold.endMs, tz)}`,
      booking: null,
    };
  }

  if (next && next.startMs - t <= DUE_SOON_MS) {
    return {
      kind: 'due',
      text: `Due ${formatClock(next.startMs, tz)} · ${next.partySize}`,
      short: `Due ${formatClock(next.startMs, tz)}`,
      sub: next.name,
      booking: next,
    };
  }

  return {
    kind: 'free',
    text: next ? `Free until ${formatClock(next.startMs, tz)}` : 'Free',
    short: 'Free',
    sub: next ? '' : 'No more bookings',
    booking: null,
  };
}

export function computeTableStates(
  snapshot: FloorPlanSnapshot,
  ctx: ServiceContext,
  pending: readonly PendingAssignment[] = [],
): Map<string, TableState> {
  return new Map(snapshot.tables.map((t) => [t.id, tableStateAt(snapshot, t, ctx, pending)]));
}

function conflictOn(
  snapshot: FloorPlanSnapshot,
  tableId: string,
  fromMs: number,
  toMs: number,
  ignoreBookingId: string,
  ctx: ServiceContext,
): FloorBooking | undefined {
  const live = isLiveDate(snapshot, ctx);
  return snapshot.bookings.find((other) => {
    if (other.id === ignoreBookingId || !other.tableIds.includes(tableId)) return false;
    if (INACTIVE_STATUSES.has(other.status)) return false;
    const [a, z] = busyWindow(other, ctx, live);
    return a < toMs && fromMs < z;
  });
}

function holdConflict(
  snapshot: FloorPlanSnapshot,
  tableId: string,
  fromMs: number,
  toMs: number,
  bookingId: string,
): FloorHold | undefined {
  return snapshot.holds.find(
    (h) =>
      h.tableId === tableId && h.bookingId !== bookingId && h.startMs < toMs && fromMs < h.endMs,
  );
}

export type LayoutPoints = Pick<FloorPlanLayout, 'tables'>;

/**
 * Advisory fit check used to highlight tables. The server re-validates every
 * assignment (capacity, holds, adjacency), so a pass here is never a guarantee.
 */
export function checkTableForBooking(
  snapshot: FloorPlanSnapshot,
  table: FloorTable,
  booking: FloorBooking,
  ctx: ServiceContext,
  layout: LayoutPoints,
): FitResult {
  const n = table.number;
  const tz = ctx.timezone;
  const live = isLiveDate(snapshot, ctx);
  const [blockFrom, to] = busyWindow(booking, ctx, live);
  // A seated party only needs the new table for the rest of its stay.
  const from = live && booking.status === 'checked_in' ? Math.max(blockFrom, ctx.nowMs) : blockFrom;

  if (table.outOfService) return { ok: false, reason: `${n} is out of service.` };
  if (!table.bookable) return { ok: false, reason: `${n} is turned off in Tables settings.` };
  if (booking.tableIds.length === 1 && booking.tableIds[0] === table.id) {
    return { ok: false, reason: `${n} is this booking’s table already.` };
  }
  if (holdConflict(snapshot, table.id, from, to, booking.id)) {
    return { ok: false, reason: `${n} is held while another booking is being made.` };
  }
  if (booking.partySize < table.minParty) {
    return { ok: false, reason: `${n} is for parties of ${table.minParty} or more.` };
  }
  const clash = conflictOn(snapshot, table.id, from, to, booking.id, ctx);
  if (clash) {
    const [a, z] = occupancy(clash, ctx, live);
    return {
      ok: false,
      reason: `${n} is booked ${formatClock(a, tz)}–${formatClock(z, tz)}. Pick another table.`,
    };
  }
  if (booking.partySize <= table.capacity) {
    return {
      ok: true,
      tableIds: [table.id],
      label: `Fits ${booking.partySize}`,
      join: false,
      seats: table.capacity,
    };
  }
  if (table.mobility !== 'movable') {
    return {
      ok: false,
      reason: `${n} seats ${table.capacity} and is fixed, so it can’t be joined.`,
    };
  }

  const origin = layout.tables.get(table.id);
  const candidates = snapshot.tables
    .filter(
      (x) =>
        x.id !== table.id &&
        x.zoneId === table.zoneId &&
        x.mobility === 'movable' &&
        x.bookable &&
        !x.outOfService &&
        !holdConflict(snapshot, x.id, from, to, booking.id) &&
        !conflictOn(snapshot, x.id, from, to, booking.id, ctx),
    )
    .sort((a, b) => {
      const pa = layout.tables.get(a.id);
      const pb = layout.tables.get(b.id);
      if (!origin || !pa || !pb) return 0;
      return distance(pa, origin) - distance(pb, origin);
    });

  const picked: FloorTable[] = [table];
  let seats = table.capacity;
  for (const candidate of candidates) {
    if (seats >= booking.partySize || picked.length >= MAX_JOINED_TABLES) break;
    picked.push(candidate);
    seats += candidate.capacity;
  }
  if (seats >= booking.partySize) {
    return {
      ok: true,
      tableIds: picked.map((x) => x.id),
      label: `Join ${picked
        .slice(1)
        .map((x) => x.number)
        .join(' + ')}`,
      join: true,
      seats,
    };
  }
  const zoneName = snapshot.zones.find((z) => z.id === table.zoneId)?.name ?? 'This zone';
  return {
    ok: false,
    reason: `${n} seats ${table.capacity}. ${zoneName} has no free movable tables to join for ${booking.partySize}. Joins never cross zones.`,
  };
}

/** Tightest fit: fewest spare seats, then fewest joined tables. */
export function bestFitForBooking(
  snapshot: FloorPlanSnapshot,
  booking: FloorBooking,
  ctx: ServiceContext,
  layout: LayoutPoints,
): Extract<FitResult, { ok: true }> | null {
  let best: (Extract<FitResult, { ok: true }> & { score: number }) | null = null;
  for (const table of snapshot.tables) {
    const result = checkTableForBooking(snapshot, table, booking, ctx, layout);
    if (!result.ok) continue;
    const score = result.seats - booking.partySize + (result.tableIds.length - 1) * 3;
    if (!best || score < best.score) best = { ...result, score };
  }
  if (!best) return null;
  return {
    ok: true,
    tableIds: best.tableIds,
    label: best.label,
    join: best.join,
    seats: best.seats,
  };
}

export function serviceWindow(
  snapshot: FloorPlanSnapshot,
  filter: FloorServiceFilter,
): { startMs: number; endMs: number } | null {
  if (filter === 'all') return snapshot.window;
  const service = snapshot.services.find((s) => s.key === filter);
  return service ? { startMs: service.startMs, endMs: service.endMs } : snapshot.window;
}

export function inService(
  booking: FloorBooking,
  window: { startMs: number; endMs: number } | null,
): boolean {
  if (!window) return true;
  return booking.startMs >= window.startMs && booking.startMs < window.endMs;
}

export function bookingsNeedingTable(
  snapshot: FloorPlanSnapshot,
  window: { startMs: number; endMs: number } | null,
): FloorBooking[] {
  return snapshot.bookings
    .filter(
      (b) => b.tableIds.length === 0 && NEEDS_TABLE_STATUSES.has(b.status) && inService(b, window),
    )
    .sort((a, b) => a.startMs - b.startMs);
}

export function arrivingSoon(
  snapshot: FloorPlanSnapshot,
  window: { startMs: number; endMs: number } | null,
  ctx: ServiceContext,
): FloorBooking[] {
  if (!isLiveDate(snapshot, ctx) || isReadOnly(snapshot, ctx)) return [];
  return snapshot.bookings
    .filter(
      (b) =>
        b.tableIds.length > 0 &&
        (b.status === 'confirmed' || b.status === 'pending') &&
        inService(b, window) &&
        b.startMs >= ctx.atMs - ARRIVING_WINDOW_MS &&
        b.startMs <= ctx.atMs + ARRIVING_WINDOW_MS,
    )
    .sort((a, b) => a.startMs - b.startMs);
}

export type ServiceCounts = {
  seatedCovers: number;
  expectedCovers: number;
  freeTables: number;
  freeSeats: number;
  overTables: string[];
  awaiting: number;
  awaitingCovers: number;
};

export function serviceCounts(
  snapshot: FloorPlanSnapshot,
  states: Map<string, TableState>,
  window: { startMs: number; endMs: number } | null,
): ServiceCounts {
  const seen = new Set<string>();
  let seatedCovers = 0;
  let freeTables = 0;
  let freeSeats = 0;
  const overTables: string[] = [];
  for (const table of snapshot.tables) {
    const state = states.get(table.id);
    if (!state) continue;
    if (state.kind === 'free') {
      freeTables += 1;
      freeSeats += table.capacity;
    }
    if (state.kind === 'over') overTables.push(table.number);
    if (
      (state.kind === 'seated' || state.kind === 'over') &&
      state.booking &&
      !seen.has(state.booking.id)
    ) {
      seen.add(state.booking.id);
      seatedCovers += state.booking.partySize;
    }
  }
  const expectedCovers = snapshot.bookings
    .filter((b) => inService(b, window) && !INACTIVE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.partySize, 0);
  const needs = bookingsNeedingTable(snapshot, window);
  return {
    seatedCovers,
    expectedCovers,
    freeTables,
    freeSeats,
    overTables,
    awaiting: needs.length,
    awaitingCovers: needs.reduce((sum, b) => sum + b.partySize, 0),
  };
}

export function zoneSeatCounts(
  snapshot: FloorPlanSnapshot,
  states: Map<string, TableState>,
  zoneId: string,
): { seated: number; seats: number } {
  const tables = snapshot.tables.filter((t) => t.zoneId === zoneId);
  const seen = new Set<string>();
  let seated = 0;
  for (const table of tables) {
    const state = states.get(table.id);
    const booking = state?.booking;
    if (!booking || !(state.kind === 'seated' || state.kind === 'over') || seen.has(booking.id))
      continue;
    if (booking.tableIds[0] !== table.id && tables.some((t) => t.id === booking.tableIds[0]))
      continue;
    seen.add(booking.id);
    seated += booking.partySize;
  }
  return {
    seated,
    seats: tables.filter((t) => !t.outOfService).reduce((s, t) => s + t.capacity, 0),
  };
}

export type BookingActions = {
  canCheckIn: boolean;
  canComplete: boolean;
  canNoShow: boolean;
  canMove: boolean;
  canUnassign: boolean;
};

export function bookingActions(
  snapshot: FloorPlanSnapshot,
  booking: FloorBooking | null | undefined,
  ctx: ServiceContext,
): BookingActions {
  const none = {
    canCheckIn: false,
    canComplete: false,
    canNoShow: false,
    canMove: false,
    canUnassign: false,
  };
  if (!booking || isReadOnly(snapshot, ctx)) return none;
  const live = isLiveDate(snapshot, ctx);
  const upcoming = booking.status === 'confirmed' || booking.status === 'pending';
  const canMove = !FINAL_STATUSES.has(booking.status) && booking.tableIds.length > 0;
  return {
    canCheckIn:
      live &&
      upcoming &&
      booking.tableIds.length > 0 &&
      booking.startMs <= ctx.nowMs + CHECK_IN_LEAD_MS,
    canComplete: live && booking.status === 'checked_in',
    canNoShow: live && upcoming && ctx.nowMs >= booking.startMs + NO_SHOW_GRACE_MS,
    canMove,
    canUnassign: canMove && booking.status !== 'checked_in',
  };
}

export function tableNumbers(snapshot: FloorPlanSnapshot, tableIds: readonly string[]): string {
  const byId = new Map(snapshot.tables.map((t) => [t.id, t.number]));
  return tableIds.map((id) => byId.get(id) ?? '?').join(' + ');
}

export function servicesForToolbar(
  snapshot: FloorPlanSnapshot,
): Array<{ key: FloorServiceFilter; label: string }> {
  const keyed: FloorService[] = snapshot.services.filter((s) => s.key !== 'other');
  const items: Array<{ key: FloorServiceFilter; label: string }> = keyed.map((s) => ({
    key: s.key,
    label: s.label,
  }));
  if (items.length !== 1) items.push({ key: 'all', label: items.length ? 'All' : 'All day' });
  return items;
}

/** Default service for a date: the one running now (today), else the last service with bookings, else the first. */
export function defaultService(
  snapshot: FloorPlanSnapshot,
  ctx: ServiceContext,
): FloorServiceFilter {
  const keyed = snapshot.services.filter((s) => s.key !== 'other');
  if (keyed.length === 0) return 'all';
  if (isLiveDate(snapshot, ctx)) {
    const running = keyed.find((s) => ctx.nowMs >= s.startMs && ctx.nowMs < s.endMs);
    if (running) return running.key;
    const upcoming = keyed.find((s) => ctx.nowMs < s.startMs);
    if (upcoming) return upcoming.key;
    return keyed[keyed.length - 1]!.key;
  }
  return keyed.length === 1 ? keyed[0]!.key : 'all';
}

/** The time the scrubber should land on for a date + service. */
export function defaultTimeFor(
  snapshot: FloorPlanSnapshot,
  filter: FloorServiceFilter,
  ctx: Pick<ServiceContext, 'nowMs' | 'today'>,
): number {
  const window = serviceWindow(snapshot, filter);
  if (!window) return ctx.nowMs;
  if (snapshot.date === ctx.today && ctx.nowMs >= window.startMs && ctx.nowMs <= window.endMs) {
    return ctx.nowMs;
  }
  const mid = window.startMs + Math.min(150 * MINUTE_MS, (window.endMs - window.startMs) / 2);
  return Math.round(mid / (5 * MINUTE_MS)) * 5 * MINUTE_MS;
}
