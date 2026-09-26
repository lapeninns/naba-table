import type { ServiceContext } from '@/components/features/floor-plan/model/floorPlanState';
import type {
  FloorBooking,
  FloorPlanSnapshot,
  FloorTable,
} from '@/components/features/floor-plan/model/floorPlanTypes';

export const TZ = 'Europe/London';
export const DATE = '2026-09-25';
/** 2026-09-25T19:31 Europe/London (BST, UTC+1). */
export const NOW = Date.UTC(2026, 8, 25, 18, 31);

export function at(hhmm: string, date = DATE): number {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  return Date.UTC(y!, mo! - 1, d!, h! - 1, m!);
}

export function table(
  id: string,
  zoneId: string,
  capacity: number,
  overrides: Partial<FloorTable> = {},
): FloorTable {
  return {
    id,
    number: id,
    zoneId,
    capacity,
    minParty: capacity <= 2 ? 1 : 2,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    bookable: true,
    outOfService: false,
    notes: null,
    shape: 'rect',
    savedPosition: null,
    ...overrides,
  };
}

export function booking(
  id: string,
  partySize: number,
  start: string,
  minutes: number,
  status: FloorBooking['status'],
  tableIds: string[] = [],
  overrides: Partial<FloorBooking> = {},
): FloorBooking {
  const startMs = at(start);
  const endMs = startMs + minutes * 60_000;
  return {
    id,
    name: id.toUpperCase(),
    partySize,
    status,
    startMs,
    endMs,
    blockStartMs: startMs,
    blockEndMs: endMs,
    checkedInAtMs: null,
    checkedOutAtMs: null,
    tableIds,
    tags: [],
    reference: null,
    ...overrides,
  };
}

export function snapshot(overrides: Partial<FloorPlanSnapshot> = {}): FloorPlanSnapshot {
  return {
    restaurantId: 'rest-1',
    date: DATE,
    timezone: TZ,
    isClosed: false,
    window: { startMs: at('12:00'), endMs: at('22:30') },
    services: [
      { key: 'lunch', label: 'Lunch', startMs: at('12:00'), endMs: at('15:00') },
      { key: 'dinner', label: 'Dinner', startMs: at('17:00'), endMs: at('22:30') },
    ],
    zones: [
      { id: 'main', name: 'Main room', sortOrder: 0, active: true },
      { id: 'snug', name: 'Snug', sortOrder: 1, active: true },
    ],
    tables: [
      table('T1', 'main', 2),
      table('T2', 'main', 2),
      table('T3', 'main', 4),
      table('T4', 'main', 4),
      table('T5', 'main', 4, { mobility: 'fixed', seatingType: 'booth' }),
      table('T8', 'main', 4, { outOfService: true }),
      table('S1', 'snug', 4, { mobility: 'fixed' }),
    ],
    bookings: [],
    holds: [],
    ...overrides,
  };
}

export function ctx(overrides: Partial<ServiceContext> = {}): ServiceContext {
  return { nowMs: NOW, atMs: NOW, today: DATE, timezone: TZ, ...overrides };
}
