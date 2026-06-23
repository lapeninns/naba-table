/**
 * Static mock data for the floor-plan dev harness (UX/UI audit surface only).
 *
 * A hand-laid 13-table room across 3 zones that exercises every service state,
 * every table geometry (standard / booth / high-top / private), and one joined
 * group. Positions are raw venue-space coords; the harness feeds them through the
 * real `buildLayout`/projection path so the rendered map matches production 1:1.
 */
import type { FloorPlanTable, ResolvedTableState, ServiceState } from '@/components/features/floor-plan/domain/types';

export const VENUE_NAME = 'The Brasserie (Dev)';
export const TIMEZONE = 'Europe/London';
export const DATE = '2026-06-23';

// Service window: 16:00–23:00 UTC; playback head at 19:30.
export const WINDOW_START_MS = Date.parse('2026-06-23T16:00:00.000Z');
export const WINDOW_END_MS = Date.parse('2026-06-23T23:00:00.000Z');
export const EFFECTIVE_MS = Date.parse('2026-06-23T19:30:00.000Z');

type Booking = {
  id: string;
  customerName: string | null;
  partySize: number;
  status: string;
  startAt: string;
  endAt: string;
};

function booking(
  id: string,
  customerName: string | null,
  partySize: number,
  status: string,
  start: string,
  end: string,
): Booking {
  return {
    id,
    customerName,
    partySize,
    status,
    startAt: `2026-06-23T${start}:00.000Z`,
    endAt: `2026-06-23T${end}:00.000Z`,
  };
}

type Seed = {
  id: string;
  num: string;
  cap: number;
  category: 'standard' | 'private';
  seatingType: 'standard' | 'booth' | 'high_top';
  mobility: 'movable' | 'fixed';
  zoneId: string;
  zoneName: string;
  x: number;
  y: number;
  state: ServiceState;
  booking: Booking | null;
};

const SEEDS: Seed[] = [
  // ── Main dining ─────────────────────────────────────────────────────────
  { id: 't1', num: '1', cap: 2, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-main', zoneName: 'Main dining', x: 140, y: 120, state: 'seated', booking: booking('bk1', 'Okafor', 2, 'checked_in', '19:00', '20:30') },
  { id: 't2', num: '2', cap: 4, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-main', zoneName: 'Main dining', x: 320, y: 120, state: 'confirmed', booking: booking('bk2', 'Nguyen', 4, 'confirmed', '20:00', '21:30') },
  { id: 't3', num: '3', cap: 4, category: 'standard', seatingType: 'booth', mobility: 'fixed', zoneId: 'z-main', zoneName: 'Main dining', x: 500, y: 120, state: 'finishing', booking: booking('bk3', 'Bauer', 3, 'checked_in', '18:00', '19:45') },
  { id: 't4', num: '4', cap: 6, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-main', zoneName: 'Main dining', x: 140, y: 270, state: 'overdue', booking: booking('bk4', 'Rossi', 5, 'checked_in', '17:30', '19:00') },
  { id: 't5', num: '5', cap: 4, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-main', zoneName: 'Main dining', x: 320, y: 270, state: 'seated', booking: booking('bkj', 'Goldberg', 7, 'checked_in', '19:15', '21:00') },
  { id: 't6', num: '6', cap: 4, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-main', zoneName: 'Main dining', x: 440, y: 270, state: 'seated', booking: booking('bkj', 'Goldberg', 7, 'checked_in', '19:15', '21:00') },
  { id: 't7', num: '7', cap: 2, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-main', zoneName: 'Main dining', x: 140, y: 410, state: 'free', booking: null },
  { id: 't8', num: 'PR', cap: 8, category: 'private', seatingType: 'standard', mobility: 'fixed', zoneId: 'z-main', zoneName: 'Main dining', x: 360, y: 410, state: 'held', booking: booking('bk8', null, 6, 'pending', '21:00', '23:00') },
  // ── Terrace ─────────────────────────────────────────────────────────────
  { id: 't9', num: '21', cap: 2, category: 'standard', seatingType: 'standard', mobility: 'movable', zoneId: 'z-terrace', zoneName: 'Terrace', x: 760, y: 130, state: 'walkin', booking: booking('bk9', 'Walk-in', 2, 'checked_in', '19:20', '20:20') },
  { id: 't10', num: '22', cap: 4, category: 'standard', seatingType: 'booth', mobility: 'fixed', zoneId: 'z-terrace', zoneName: 'Terrace', x: 760, y: 270, state: 'free', booking: null },
  // ── Bar ─────────────────────────────────────────────────────────────────
  { id: 'b1', num: 'B1', cap: 2, category: 'standard', seatingType: 'high_top', mobility: 'fixed', zoneId: 'z-bar', zoneName: 'Bar', x: 720, y: 440, state: 'free', booking: null },
  { id: 'b2', num: 'B2', cap: 2, category: 'standard', seatingType: 'high_top', mobility: 'fixed', zoneId: 'z-bar', zoneName: 'Bar', x: 820, y: 440, state: 'seated', booking: booking('bk12', 'Singh', 2, 'checked_in', '19:00', '20:00') },
  { id: 'b3', num: 'B3', cap: 2, category: 'standard', seatingType: 'high_top', mobility: 'fixed', zoneId: 'z-bar', zoneName: 'Bar', x: 920, y: 440, state: 'free', booking: null },
];

export const MOCK_TABLES: FloorPlanTable[] = SEEDS.map(
  (s) =>
    ({
      id: s.id,
      restaurantId: 'r-dev',
      tableNumber: s.num,
      capacity: s.cap,
      minPartySize: 1,
      maxPartySize: s.cap,
      section: s.zoneName,
      category: s.category,
      seatingType: s.seatingType,
      mobility: s.mobility,
      zoneId: s.zoneId,
      zoneName: s.zoneName,
      zoneActive: true,
      active: true,
      status: 'active',
      position: { x: s.x, y: s.y, rotation: 0 },
      notes: null,
      segments: [],
    }) as unknown as FloorPlanTable,
);

export const RESOLVED_BY_ID: Record<string, ResolvedTableState> = Object.fromEntries(
  SEEDS.map((s) => [
    s.id,
    {
      state: s.state,
      segment: null,
      booking: s.booking as unknown as ResolvedTableState['booking'],
      outOfService: false,
    },
  ]),
);

export const JOIN_GROUPS = [{ bookingId: 'bkj', tableIds: ['t5', 't6'], capacity: 8 }];

/**
 * Per-zone occupancy for the detail-panel summary (the default, no-selection aside).
 * Covers/capacity are kept consistent with the global stats (28/46 seated) so the
 * aside agrees with the cockpit. left/top/width/height are unused here — the canvas
 * derives its own dashed zone regions from the projected node positions.
 */
export const ZONES = [
  { key: 'z-main', name: 'Main dining', count: 8, seatedCovers: 24, capacity: 34, occupancyPct: 71, left: 0, top: 0, width: 0, height: 0 },
  { key: 'z-terrace', name: 'Terrace', count: 2, seatedCovers: 2, capacity: 6, occupancyPct: 33, left: 0, top: 0, width: 0, height: 0 },
  { key: 'z-bar', name: 'Bar', count: 3, seatedCovers: 2, capacity: 6, occupancyPct: 33, left: 0, top: 0, width: 0, height: 0 },
];
