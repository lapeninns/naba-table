import { DateTime } from 'luxon';

import { getVenuePolicy } from '@/server/capacity/policy';
import { buildBusyMaps } from '@/server/capacity/table-assignment/availability';
import { computeBookingWindowWithFallback } from '@/server/capacity/table-assignment/booking-window';
import { loadActiveHoldsForDate } from '@/server/capacity/table-assignment/supabase';
import { listTablesWithSummary, type TableRecord } from '@/server/ops/tables';
import { getRestaurantSchedule, type RestaurantSchedule } from '@/server/restaurants/schedule';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { TableHold } from '@/server/capacity/holds';
import type { ContextBookingRow } from '@/server/capacity/table-assignment/supabase';
import type {
  OpsBookingStatus,
  TableTimelineResponse,
  TableTimelineSegment,
  TableTimelineServiceKey,
} from '@/types/ops';
import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const TIMELINE_STATUS_FILTER: Tables<'bookings'>['status'][] = ['pending', 'pending_allocation', 'confirmed', 'checked_in', 'completed'];

const SERVICE_LABELS: Record<TableTimelineServiceKey, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks',
  other: 'Service',
};

type TimelineBookingRow = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'party_size'
  | 'status'
  | 'start_time'
  | 'end_time'
  | 'start_at'
  | 'end_at'
  | 'booking_date'
  | 'customer_name'
  | 'customer_email'
  | 'customer_email'
  | 'customer_phone'
  | 'notes'
> & {
  booking_table_assignments: Array<{ table_id: string | null }> | null;
};

type TimelineParams = {
  restaurantId: string;
  date?: string | null;
  zoneId?: string | null;
  service?: 'lunch' | 'dinner' | 'all';
  client?: SupabaseClient<Database, 'public'>;
};

type SlotMetadata = {
  slots: TableTimelineResponse['slots'];
  windowStart: DateTime | null;
  windowEnd: DateTime | null;
  services: TableTimelineResponse['services'];
};

type BookingMeta = {
  id: string;
  customerName: string | null;
  partySize: number;
  status: OpsBookingStatus;
  startAt: string;
  endAt: string;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  tableIds: string[];
};

type BusyWindow = {
  tableId: string;
  startAt: string;
  endAt: string;
  bookingId: string | null;
  source: 'booking' | 'hold';
};

export async function getTableAvailabilityTimeline({
  restaurantId,
  date,
  zoneId,
  service = 'all',
  client,
}: TimelineParams): Promise<TableTimelineResponse> {
  const supabase = client ?? getServiceSupabaseClient();
  const schedule = await getRestaurantSchedule(restaurantId, { date: date ?? undefined, client: supabase });
  const { tables, summary } = await listTablesWithSummary(supabase, restaurantId, zoneId ? { zoneId } : {});
  const filteredTables = zoneId ? tables.filter((table) => table.zone_id === zoneId) : tables;

  if (!schedule.window.opensAt || !schedule.window.closesAt || schedule.isClosed) {
    return buildClosedResponse(schedule, summary ?? null);
  }

  const slotMeta = buildSlotMetadata(schedule, service);
  if (!slotMeta.windowStart || !slotMeta.windowEnd || slotMeta.slots.length === 0) {
    return buildClosedResponse(schedule, summary ?? null, slotMeta.services);
  }

  const policy = getVenuePolicy({ timezone: schedule.timezone });
  const bookingsResult = await loadTimelineBookings(supabase, restaurantId, schedule.date);
  const { contextRows, bookingMeta } = enrichBookings(bookingsResult, policy);
  const holds = await loadHolds(supabase, restaurantId, schedule.date, policy);
  const busyMap = buildBusyMaps({
    targetBookingId: '__timeline__',
    bookings: contextRows,
    holds,
    policy,
  });
  const holdLookup = buildHoldLookup(holds);

  const tablesResponse = filteredTables.map((table) =>
    buildRowForTable({
      table,
      busyWindows: (busyMap.get(table.id)?.windows ?? []) as BusyWindow[],
      windowStart: slotMeta.windowStart!,
      windowEnd: slotMeta.windowEnd!,
      bookingMeta,
      holdLookup,
      services: slotMeta.services,
    }),
  );

  return {
    date: schedule.date,
    timezone: schedule.timezone,
    window: {
      start: slotMeta.windowStart.toISO() ?? '',
      end: slotMeta.windowEnd.toISO() ?? '',
      isClosed: false,
    },
    slots: slotMeta.slots,
    services: slotMeta.services,
    summary: summary ?? null,
    tables: tablesResponse,
  };
}

function buildClosedResponse(
  schedule: RestaurantSchedule,
  summary: TableTimelineResponse['summary'],
  services: TableTimelineResponse['services'] = [],
): TableTimelineResponse {
  return {
    date: schedule.date,
    timezone: schedule.timezone,
    window: {
      start: '',
      end: '',
      isClosed: true,
    },
    slots: [],
    services,
    summary,
    tables: [],
  };
}

async function loadTimelineBookings(
  supabase: SupabaseClient<Database, 'public'>,
  restaurantId: string,
  date: string,
): Promise<TimelineBookingRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, party_size, status, start_time, end_time, start_at, end_at, booking_date, customer_name, customer_email, customer_phone, notes, booking_table_assignments(table_id)`,
    )
    .eq('restaurant_id', restaurantId)
    .eq('booking_date', date)
    .in('status', TIMELINE_STATUS_FILTER)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[ops][tables][timeline] failed to load bookings', error.message);
    return [];
  }

  return (data ?? []) as TimelineBookingRow[];
}

function enrichBookings(bookings: TimelineBookingRow[], policy: ReturnType<typeof getVenuePolicy>) {
  const bookingMeta = new Map<string, BookingMeta>();
  const contextRows: ContextBookingRow[] = [];

  for (const booking of bookings) {
    contextRows.push({
      id: booking.id,
      party_size: booking.party_size ?? 0,
      status: normalizeOpsStatus(booking.status),
      start_time: booking.start_time,
      end_time: booking.end_time,
      start_at: booking.start_at,
      end_at: booking.end_at,
      booking_date: booking.booking_date,
      seating_preference: null,
      booking_table_assignments: booking.booking_table_assignments ?? [],
    });

    try {
      const { window } = computeBookingWindowWithFallback({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize: booking.party_size ?? 0,
        policy,
      });

      // Collect assigned table IDs
      const tableIds = (booking.booking_table_assignments ?? [])
        .map(a => a.table_id)
        .filter((id): id is string => id !== null);

      bookingMeta.set(booking.id, {
        id: booking.id,
        customerName: booking.customer_name ?? null,
        partySize: booking.party_size ?? 0,
        status: normalizeOpsStatus(booking.status),
        startAt: window.block.start.toISO() ?? booking.start_at ?? '',
        endAt: window.block.end.toISO() ?? booking.end_at ?? '',
        customerEmail: booking.customer_email ?? null,
        customerPhone: booking.customer_phone ?? null,
        notes: booking.notes ?? null,
        tableIds,
      });
    } catch (error) {
      console.warn('[ops][tables][timeline] unable to compute booking window', {
        bookingId: booking.id,
        error,
      });
    }
  }

  return { contextRows, bookingMeta };
}

async function loadHolds(
  supabase: SupabaseClient<Database, 'public'>,
  restaurantId: string,
  date: string,
  policy: ReturnType<typeof getVenuePolicy>,
): Promise<TableHold[]> {
  try {
    return await loadActiveHoldsForDate(restaurantId, date, policy, supabase);
  } catch (error) {
    console.warn('[ops][tables][timeline] failed to load holds', error);
    return [];
  }
}

type HoldLookup = Map<string, Array<{ id: string; bookingId: string | null; startAt: string; endAt: string }>>;

function buildHoldLookup(holds: TableHold[]): HoldLookup {
  const lookup: HoldLookup = new Map();

  for (const hold of holds) {
    if (!Array.isArray(hold.tableIds)) continue;
    for (const tableId of hold.tableIds) {
      if (!tableId) continue;
      const entry = lookup.get(tableId) ?? [];
      entry.push({
        id: hold.id,
        bookingId: hold.bookingId ?? null,
        startAt: hold.startAt,
        endAt: hold.endAt,
      });
      lookup.set(tableId, entry);
    }
  }

  return lookup;
}

function buildSlotMetadata(schedule: RestaurantSchedule, serviceFilter: 'lunch' | 'dinner' | 'all'): SlotMetadata {
  const intervalMinutes = schedule.intervalMinutes ?? 15;
  const timezone = schedule.timezone ?? 'UTC';
  const slots: TableTimelineResponse['slots'] = [];
  const servicesMap = new Map<TableTimelineServiceKey, { start: DateTime; end: DateTime; slotCount: number }>();

  const relevantSlots = schedule.slots.filter((slot) => {
    if (serviceFilter === 'all') return true;
    return slot.bookingOption === serviceFilter;
  });

  for (const slot of relevantSlots) {
    const start = toDateTime(schedule.date, slot.value, timezone);
    if (!start) continue;
    const end = start.plus({ minutes: intervalMinutes });
    const serviceKey = normalizeServiceKey(slot.bookingOption);

    slots.push({
      start: start.toISO() ?? '',
      end: end.toISO() ?? '',
      label: slot.display,
      serviceKey,
      disabled: Boolean(slot.disabled),
    });

    if (!servicesMap.has(serviceKey)) {
      servicesMap.set(serviceKey, { start, end, slotCount: 0 });
    }
    const entry = servicesMap.get(serviceKey)!;
    entry.start = DateTime.min(entry.start, start);
    entry.end = DateTime.max(entry.end, end);
    entry.slotCount += 1;
  }

  const windowStart = slots.length > 0 ? DateTime.fromISO(slots[0]!.start) : null;
  const windowEnd = slots.length > 0 ? DateTime.fromISO(slots[slots.length - 1]!.end) : null;
  const services = Array.from(servicesMap.entries()).map(([key, value]) => ({
    key,
    label: SERVICE_LABELS[key] ?? 'Service',
    start: value.start.toISO() ?? '',
    end: value.end.toISO() ?? '',
    slotCount: value.slotCount,
  }));

  return {
    slots,
    windowStart,
    windowEnd,
    services,
  };
}

function buildRowForTable({
  table,
  busyWindows,
  windowStart,
  windowEnd,
  bookingMeta,
  holdLookup,
  services,
}: {
  table: TableRecord;
  busyWindows: BusyWindow[];
  windowStart: DateTime;
  windowEnd: DateTime;
  bookingMeta: Map<string, BookingMeta>;
  holdLookup: HoldLookup;
  services: TableTimelineResponse['services'];
}): TableTimelineResponse['tables'][number] {
  if (!table.active || table.status === 'out_of_service') {
    const segment: TableTimelineSegment = {
      start: windowStart.toISO() ?? '',
      end: windowEnd.toISO() ?? '',
      state: 'out_of_service',
      serviceKey: resolveServiceKey(windowStart, services),
    };
    return {
      table: serializeTable(table),
      stats: buildStatsFromSegments([segment], table, windowStart, windowEnd),
      segments: [segment],
    };
  }

  const segments = buildSegmentsFromBusyWindows({
    tableId: table.id,
    windows: busyWindows,
    windowStart,
    windowEnd,
    bookingMeta,
    holdLookup,
    services,
  });

  return {
    table: serializeTable(table),
    stats: buildStatsFromSegments(segments, table, windowStart, windowEnd),
    segments,
  };
}

function serializeTable(table: TableRecord) {
  return {
    id: table.id,
    tableNumber: table.table_number,
    capacity: table.capacity ?? 0,
    zoneId: table.zone_id ?? null,
    zoneName: table.zone?.name ?? null,
    status: table.status ?? 'available',
    active: table.active ?? true,
  };
}

function buildSegmentsFromBusyWindows({
  tableId,
  windows,
  windowStart,
  windowEnd,
  bookingMeta,
  holdLookup,
  services,
}: {
  tableId: string;
  windows: BusyWindow[];
  windowStart: DateTime;
  windowEnd: DateTime;
  bookingMeta: Map<string, BookingMeta>;
  holdLookup: HoldLookup;
  services: TableTimelineResponse['services'];
}): TableTimelineSegment[] {
  if (!windows || windows.length === 0) {
    return [
      {
        start: windowStart.toISO() ?? '',
        end: windowEnd.toISO() ?? '',
        state: 'available',
        serviceKey: resolveServiceKey(windowStart, services),
      },
    ];
  }

  const holdsForTable = holdLookup.get(tableId) ?? [];

  const sorted = windows
    .map((window) => ({
      start: DateTime.fromISO(window.startAt),
      end: DateTime.fromISO(window.endAt),
      bookingId: window.bookingId,
      source: window.source,
    }))
    .filter((window) => window.start.isValid && window.end.isValid)
    .map((window) => ({
      ...window,
      start: DateTime.max(window.start, windowStart),
      end: DateTime.min(window.end, windowEnd),
    }))
    .filter((window) => window.end > windowStart && window.start < windowEnd)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const segments: TableTimelineSegment[] = [];
  let cursor = windowStart;

  for (const window of sorted) {
    if (window.start > cursor) {
      segments.push({
        start: cursor.toISO() ?? '',
        end: window.start.toISO() ?? '',
        state: 'available',
        serviceKey: resolveServiceKey(cursor, services),
      });
    }

    const booking = window.bookingId ? bookingMeta.get(window.bookingId) : null;
    const hold =
      !booking && window.source === 'hold'
        ? findHoldForWindow(holdsForTable, window.start, window.end)
        : null;

    segments.push({
      start: window.start.toISO() ?? '',
      end: window.end.toISO() ?? '',
      state: window.source === 'hold' && !booking ? 'hold' : 'reserved',
      serviceKey: resolveServiceKey(window.start, services),
      booking: booking
        ? {
          id: booking.id,
          customerName: booking.customerName,
          partySize: booking.partySize,
          status: booking.status,
          startAt: booking.startAt,
          endAt: booking.endAt,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          notes: booking.notes,
          tableIds: booking.tableIds,
        }
        : null,
      hold: hold,
    });

    if (window.end > cursor) {
      cursor = window.end;
    }
  }

  if (cursor < windowEnd) {
    segments.push({
      start: cursor.toISO() ?? '',
      end: windowEnd.toISO() ?? '',
      state: 'available',
      serviceKey: resolveServiceKey(cursor, services),
    });
  }

  return segments.filter((segment) => segment.start !== segment.end);
}

function buildStatsFromSegments(
  segments: TableTimelineSegment[],
  _table: TableRecord,
  windowStart: DateTime,
  windowEnd: DateTime,
) {
  const totalMinutes = windowEnd.diff(windowStart, 'minutes').minutes;
  const occupiedMinutes = segments.reduce((sum, segment) => {
    if (segment.state === 'available') return sum;
    const diff = DateTime.fromISO(segment.end).diff(DateTime.fromISO(segment.start), 'minutes').minutes;
    return sum + Math.max(0, diff);
  }, 0);

  return {
    occupancyMinutes: occupiedMinutes,
    totalMinutes,
    occupancyPercentage: totalMinutes > 0 ? occupiedMinutes / totalMinutes : 0,
    nextStateAt: segments.find((segment) => segment.state !== 'available')?.start ?? null,
  };
}

function toDateTime(date: string, time: string, timezone: string): DateTime | null {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  return dt.isValid ? dt : null;
}

function findHoldForWindow(
  holds: Array<{ id: string; bookingId: string | null; startAt: string; endAt: string }>,
  windowStart: DateTime,
  windowEnd: DateTime,
) {
  for (const hold of holds) {
    const holdStart = DateTime.fromISO(hold.startAt);
    const holdEnd = DateTime.fromISO(hold.endAt);
    if (!holdStart.isValid || !holdEnd.isValid) continue;
    if (rangesOverlap(windowStart, windowEnd, holdStart, holdEnd)) {
      return hold;
    }
  }
  return null;
}

function rangesOverlap(aStart: DateTime, aEnd: DateTime, bStart: DateTime, bEnd: DateTime): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function normalizeServiceKey(option: string | null): TableTimelineServiceKey {
  if (option === 'lunch' || option === 'dinner' || option === 'drinks') {
    return option;
  }
  return 'other';
}

function resolveServiceKey(timestamp: DateTime, services: TableTimelineResponse['services']): TableTimelineServiceKey {
  for (const service of services) {
    const start = DateTime.fromISO(service.start);
    const end = DateTime.fromISO(service.end);
    if (start.isValid && end.isValid && timestamp >= start && timestamp < end) {
      return service.key;
    }
  }
  return 'other';
}

const OPS_STATUS_VALUES: OpsBookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
];

export function normalizeOpsStatus(value: string | null | undefined): OpsBookingStatus {
  if (value && OPS_STATUS_VALUES.includes(value as OpsBookingStatus)) {
    return value as OpsBookingStatus;
  }
  return 'pending';
}
