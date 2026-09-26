import { describe, expect, it } from 'vitest';

import {
  buildFloorLayoutSnapshot,
  buildFloorPlanSnapshot,
  toFloorTable,
} from '@/components/features/floor-plan/model/floorPlanSnapshot';

import type { ListTablesResult, TableInventory } from '@/services/ops/tables';
import type { OpsTodayBookingsSummary, TableTimelineResponse } from '@/types/ops';

function inventory(overrides: Partial<TableInventory>): TableInventory {
  return {
    id: 't1',
    restaurantId: 'rest-1',
    tableNumber: 'T1',
    capacity: 4,
    minPartySize: 2,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Main',
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
    ...overrides,
  };
}

const tables: ListTablesResult = {
  tables: [
    inventory({ id: 't1', tableNumber: 'T1', position: { x: 120, y: 90, rotation: 90 } }),
    inventory({
      id: 't2',
      tableNumber: 'T2',
      capacity: 8,
      zoneId: 'z2',
      zoneName: 'Garden',
      zoneActive: false,
    }),
    inventory({
      id: 't3',
      tableNumber: 'T3',
      status: 'out_of_service',
      seatingType: 'booth',
      capacity: 8,
    }),
  ],
  summary: {
    totalTables: 3,
    totalCapacity: 20,
    availableTables: 2,
    zones: [{ id: 'z1', name: 'Main', active: true, sortOrder: 0 }],
    serviceCapacities: [],
  },
};

const summary = {
  restaurantId: 'rest-1',
  date: '2026-09-25',
  timezone: 'Europe/London',
  bookings: [
    {
      id: 'b1',
      status: 'checked_in',
      partySize: 4,
      customerName: '  Okafor ',
      reference: 'ABC',
      startIso: '2026-09-25T18:00:00.000Z',
      endIso: '2026-09-25T20:00:00.000Z',
      checkedInAt: '2026-09-25T18:04:00.000Z',
      checkedOutAt: null,
      allergies: ['Peanuts'],
      dietaryRestrictions: ['Vegan'],
      seatingPreference: 'Wheelchair access',
      tableAssignments: [
        {
          groupId: null,
          capacitySum: 4,
          members: [{ tableId: 't1', tableNumber: 'T1', capacity: 4, section: null }],
        },
        {
          groupId: null,
          capacitySum: 4,
          members: [{ tableId: 't1', tableNumber: 'T1', capacity: 4, section: null }],
        },
      ],
    },
    {
      id: 'no-time',
      status: 'confirmed',
      partySize: 2,
      customerName: null,
      startIso: undefined,
      tableAssignments: [],
    },
  ],
} as unknown as OpsTodayBookingsSummary;

const timeline = {
  date: '2026-09-25',
  timezone: 'Europe/London',
  window: { start: '2026-09-25T11:00:00.000Z', end: '2026-09-25T21:30:00.000Z', isClosed: false },
  slots: [],
  services: [
    {
      key: 'dinner',
      label: 'Dinner',
      start: '2026-09-25T16:00:00.000Z',
      end: '2026-09-25T21:30:00.000Z',
      slotCount: 1,
    },
    {
      key: 'lunch',
      label: 'Lunch',
      start: '2026-09-25T11:00:00.000Z',
      end: '2026-09-25T14:00:00.000Z',
      slotCount: 1,
    },
  ],
  summary: null,
  tables: [
    {
      table: { id: 't1' },
      stats: {},
      segments: [
        {
          start: '2026-09-25T17:45:00.000Z',
          end: '2026-09-25T20:15:00.000Z',
          state: 'reserved',
          serviceKey: 'dinner',
          booking: {
            id: 'b1',
            startAt: '2026-09-25T17:45:00.000Z',
            endAt: '2026-09-25T20:15:00.000Z',
          },
        },
      ],
    },
    {
      table: { id: 't2' },
      stats: {},
      segments: [
        {
          start: '2026-09-25T18:30:00.000Z',
          end: '2026-09-25T18:40:00.000Z',
          state: 'hold',
          serviceKey: 'dinner',
          hold: {
            id: 'h1',
            bookingId: null,
            startAt: '2026-09-25T18:30:00.000Z',
            endAt: '2026-09-25T18:40:00.000Z',
          },
        },
      ],
    },
  ],
} as unknown as TableTimelineResponse;

describe('buildFloorPlanSnapshot', () => {
  const snap = buildFloorPlanSnapshot({
    restaurantId: 'rest-1',
    date: '2026-09-25',
    tables,
    summary,
    timeline,
  });

  it('normalises tables, falling back to table zone names when the summary lacks a zone', () => {
    expect(snap.zones.map((z) => [z.id, z.name, z.active])).toEqual([
      ['z1', 'Main', true],
      ['z2', 'Garden', false],
    ]);
    expect(snap.tables.find((t) => t.id === 't1')?.savedPosition).toEqual({
      x: 120,
      y: 90,
      rotation: 90,
    });
    expect(snap.tables.find((t) => t.id === 't2')).toMatchObject({
      bookable: false,
      shape: 'round',
    });
    expect(snap.tables.find((t) => t.id === 't3')).toMatchObject({
      outOfService: true,
      shape: 'rect',
    });
  });

  it('merges block windows, de-duplicates table ids and derives tags', () => {
    expect(snap.bookings).toHaveLength(1);
    expect(snap.bookings[0]).toMatchObject({
      id: 'b1',
      name: 'Okafor',
      tableIds: ['t1'],
      startMs: Date.parse('2026-09-25T18:00:00.000Z'),
      blockStartMs: Date.parse('2026-09-25T17:45:00.000Z'),
      blockEndMs: Date.parse('2026-09-25T20:15:00.000Z'),
      checkedInAtMs: Date.parse('2026-09-25T18:04:00.000Z'),
      tags: [
        { kind: 'allergy', label: 'Peanuts' },
        { kind: 'access', label: 'Accessible seating' },
        { kind: 'note', label: 'Vegan' },
      ],
    });
  });

  it('orders services by start and extracts holds', () => {
    expect(snap.services.map((s) => s.key)).toEqual(['lunch', 'dinner']);
    expect(snap.holds).toEqual([
      {
        id: 'h1',
        tableId: 't2',
        bookingId: null,
        startMs: Date.parse('2026-09-25T18:30:00.000Z'),
        endMs: Date.parse('2026-09-25T18:40:00.000Z'),
      },
    ]);
    expect(snap.window).not.toBeNull();
  });

  it('ignores malformed stored positions', () => {
    expect(
      toFloorTable(inventory({ position: { x: 'a' } as unknown as Record<string, unknown> }))
        .savedPosition,
    ).toBeNull();
    expect(toFloorTable(inventory({ position: { x: 1, y: 2 } })).savedPosition).toEqual({
      x: 1,
      y: 2,
      rotation: 0,
    });
  });
});

describe('buildFloorLayoutSnapshot', () => {
  it('builds the room from tables alone, with no service, bookings or holds', () => {
    const snap = buildFloorLayoutSnapshot({ restaurantId: 'rest-1', date: '2026-09-26', tables });

    expect(snap.tables.map((t) => t.id)).toEqual(tables.tables.map((t) => t.id));
    expect(snap.zones.length).toBeGreaterThan(0);
    expect(snap).toMatchObject({
      restaurantId: 'rest-1',
      date: '2026-09-26',
      isClosed: false,
      window: null,
      services: [],
      bookings: [],
      holds: [],
    });
  });
});
