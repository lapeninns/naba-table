import { parseIsoMs } from './floorPlanTime';

import type {
  FloorBooking,
  FloorBookingTag,
  FloorHold,
  FloorPlanSnapshot,
  FloorPosition,
  FloorService,
  FloorTable,
  FloorZone,
} from './floorPlanTypes';
import type { ListTablesResult, TableInventory } from '@/services/ops/tables';
import type { OpsTodayBooking, OpsTodayBookingsSummary, TableTimelineResponse } from '@/types/ops';

export function readStoredPosition(value: TableInventory['position']): FloorPosition | null {
  if (!value) return null;
  const { x, y, rotation } = value as { x?: unknown; y?: unknown; rotation?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return { x, y, rotation: typeof rotation === 'number' ? rotation : 0 };
}

export function toFloorTable(table: TableInventory): FloorTable {
  const isBoothLike = table.seatingType === 'booth' || table.seatingType === 'sofa';
  return {
    id: table.id,
    number: table.tableNumber,
    zoneId: table.zoneId,
    capacity: table.capacity,
    minParty: table.minPartySize,
    category: table.category,
    seatingType: table.seatingType,
    mobility: table.mobility,
    bookable: table.active && table.zoneActive,
    outOfService: table.status === 'out_of_service',
    notes: table.notes,
    shape: !isBoothLike && table.capacity >= 7 && table.capacity <= 10 ? 'round' : 'rect',
    savedPosition: readStoredPosition(table.position),
  };
}

function buildZones(tables: ListTablesResult): FloorZone[] {
  const zones = new Map<string, FloorZone>();
  for (const zone of tables.summary?.zones ?? []) {
    zones.set(zone.id, {
      id: zone.id,
      name: zone.name,
      sortOrder: zone.sortOrder,
      active: zone.active,
    });
  }
  // Fall back to the zone names carried on each table when the summary is missing.
  for (const table of tables.tables) {
    if (!zones.has(table.zoneId)) {
      zones.set(table.zoneId, {
        id: table.zoneId,
        name: table.zoneName ?? 'Zone',
        sortOrder: Number.MAX_SAFE_INTEGER,
        active: table.zoneActive,
      });
    }
  }
  return [...zones.values()];
}

const ACCESS_PATTERN = /wheelchair|accessib|step[- ]free|mobility/i;

export function bookingTags(booking: OpsTodayBooking): FloorBookingTag[] {
  const tags: FloorBookingTag[] = [];
  for (const allergy of booking.allergies ?? []) {
    if (allergy.trim()) tags.push({ kind: 'allergy', label: allergy.trim() });
  }
  if (booking.seatingPreference && ACCESS_PATTERN.test(booking.seatingPreference)) {
    tags.push({ kind: 'access', label: 'Accessible seating' });
  }
  for (const diet of booking.dietaryRestrictions ?? []) {
    if (diet.trim()) tags.push({ kind: 'note', label: diet.trim() });
  }
  return tags;
}

type BlockWindow = { startMs: number; endMs: number };

function blockWindowsFromTimeline(timeline: TableTimelineResponse): Map<string, BlockWindow> {
  const out = new Map<string, BlockWindow>();
  for (const row of timeline.tables) {
    for (const segment of row.segments) {
      const booking = segment.booking;
      if (!booking || out.has(booking.id)) continue;
      const startMs = parseIsoMs(booking.startAt);
      const endMs = parseIsoMs(booking.endAt);
      if (startMs !== null && endMs !== null) out.set(booking.id, { startMs, endMs });
    }
  }
  return out;
}

function holdsFromTimeline(timeline: TableTimelineResponse): FloorHold[] {
  const holds: FloorHold[] = [];
  for (const row of timeline.tables) {
    for (const segment of row.segments) {
      if (segment.state !== 'hold') continue;
      const startMs = parseIsoMs(segment.hold?.startAt ?? segment.start);
      const endMs = parseIsoMs(segment.hold?.endAt ?? segment.end);
      if (startMs === null || endMs === null) continue;
      holds.push({
        id: segment.hold?.id ?? `${row.table.id}:${segment.start}`,
        tableId: row.table.id,
        bookingId: segment.hold?.bookingId ?? null,
        startMs,
        endMs,
      });
    }
  }
  return holds;
}

export function toFloorBooking(
  booking: OpsTodayBooking,
  blocks: Map<string, BlockWindow>,
): FloorBooking | null {
  const startMs = parseIsoMs(booking.startIso);
  if (startMs === null) return null;
  const parsedEnd = parseIsoMs(booking.endIso);
  const endMs = parsedEnd !== null && parsedEnd > startMs ? parsedEnd : startMs + 90 * 60_000;
  const block = blocks.get(booking.id);
  const tableIds = [
    ...new Set(booking.tableAssignments.flatMap((group) => group.members.map((m) => m.tableId))),
  ];
  return {
    id: booking.id,
    name: booking.customerName?.trim() || 'Walk-in guest',
    partySize: booking.partySize,
    status: booking.status,
    startMs,
    endMs,
    blockStartMs: block?.startMs ?? startMs,
    blockEndMs: block?.endMs ?? endMs,
    checkedInAtMs: parseIsoMs(booking.checkedInAt),
    checkedOutAtMs: parseIsoMs(booking.checkedOutAt),
    tableIds,
    tags: bookingTags(booking),
    reference: booking.reference,
  };
}

function servicesFromTimeline(timeline: TableTimelineResponse): FloorService[] {
  return timeline.services
    .map((service) => {
      const startMs = parseIsoMs(service.start);
      const endMs = parseIsoMs(service.end);
      if (startMs === null || endMs === null) return null;
      return { key: service.key, label: service.label, startMs, endMs };
    })
    .filter((service): service is FloorService => service !== null)
    .sort((a, b) => a.startMs - b.startMs);
}

export function buildFloorPlanSnapshot(input: {
  restaurantId: string;
  date: string;
  tables: ListTablesResult;
  summary: OpsTodayBookingsSummary;
  timeline: TableTimelineResponse;
}): FloorPlanSnapshot {
  const { restaurantId, date, tables, summary, timeline } = input;
  const blocks = blockWindowsFromTimeline(timeline);
  const windowStart = parseIsoMs(timeline.window.start);
  const windowEnd = parseIsoMs(timeline.window.end);
  const bookings = summary.bookings
    .map((booking) => toFloorBooking(booking, blocks))
    .filter((booking): booking is FloorBooking => booking !== null);

  return {
    restaurantId,
    date,
    timezone: summary.timezone || timeline.timezone || 'Europe/London',
    isClosed: timeline.window.isClosed,
    window:
      !timeline.window.isClosed && windowStart !== null && windowEnd !== null
        ? { startMs: windowStart, endMs: windowEnd }
        : null,
    services: servicesFromTimeline(timeline),
    zones: buildZones(tables),
    tables: tables.tables.map(toFloorTable),
    bookings,
    holds: holdsFromTimeline(timeline),
  };
}

/**
 * The saved room without a service: what the Floor layout settings page arranges. Tables and
 * zones only, so the page works on closed days and when bookings can't load.
 */
export function buildFloorLayoutSnapshot(input: {
  restaurantId: string;
  date: string;
  tables: ListTablesResult;
}): FloorPlanSnapshot {
  return {
    restaurantId: input.restaurantId,
    date: input.date,
    timezone: 'Europe/London',
    isClosed: false,
    window: null,
    services: [],
    zones: buildZones(input.tables),
    tables: input.tables.tables.map(toFloorTable),
    bookings: [],
    holds: [],
  };
}
