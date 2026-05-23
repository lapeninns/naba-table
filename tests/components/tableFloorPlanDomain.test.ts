import { describe, expect, it } from 'vitest';

import {
  deriveTableFloorPlanLayout,
  formatFloorPlanCountdown,
  formatFloorPlanTableAriaLabel,
  formatFloorPlanTableTitle,
  getFloorPlanTableVariant,
} from '@/components/features/dashboard/tableFloorPlanDomain';

import type {
  ManualAssignmentConflict,
  ManualAssignmentContextHold,
  ManualAssignmentTable,
} from '@/services/ops/bookings';

describe('tableFloorPlanDomain', () => {
  it('derives positioned table state, variants, labels, and normalized coordinates', () => {
    const tables = [
      makeTable({ id: 't-1', position: { x: 10, y: 20 } }),
      makeTable({ id: 't-2', position: { rotation: 15, x: 30, y: 60 } }),
    ];
    const holds = [makeHold({ bookingId: 'booking-1', id: 'hold-1', tableIds: ['t-1'] })];

    const layout = deriveTableFloorPlanLayout({
      bookingAssignments: ['t-2'],
      bookingId: 'booking-1',
      conflicts: [],
      holds,
      onlyAvailable: false,
      selectedTableIds: ['t-1'],
      tables,
    });

    expect(layout.positioned).toHaveLength(2);
    expect(layout.positioned[0]).toMatchObject({
      holdOwned: holds[0],
      isSelected: true,
      xPercent: 0,
      yPercent: 0,
    });
    expect(layout.positioned[1]).toMatchObject({
      isAssignedToBooking: true,
      rotation: 15,
      xPercent: 100,
      yPercent: 100,
    });
    expect(getFloorPlanTableVariant(layout.positioned[0])).toBe('selected');
    expect(formatFloorPlanTableTitle(layout.positioned[0])).toContain('Held by you');
    expect(
      formatFloorPlanTableAriaLabel({
        entry: layout.positioned[0],
        isBlocked: false,
        isSelected: true,
      }),
    ).toContain('selected');
  });

  it('filters unavailable tables while preserving assigned and owned tables', () => {
    const tables = [
      makeTable({ id: 'assigned', position: { x: 0, y: 0 }, status: 'occupied' }),
      makeTable({ id: 'owned', position: { x: 10, y: 0 } }),
      makeTable({ id: 'blocked', position: { x: 20, y: 0 } }),
      makeTable({ id: 'available', position: { x: 30, y: 0 } }),
    ];
    const holds = [
      makeHold({ bookingId: 'booking-1', id: 'hold-owned', tableIds: ['owned'] }),
      makeHold({ bookingId: 'booking-2', id: 'hold-other', tableIds: ['blocked'] }),
    ];

    const layout = deriveTableFloorPlanLayout({
      bookingAssignments: ['assigned'],
      bookingId: 'booking-1',
      conflicts: [makeConflict({ tableId: 'blocked' })],
      holds,
      onlyAvailable: true,
      selectedTableIds: [],
      tables,
    });

    expect(layout.positioned.map((entry) => entry.table.id)).toEqual([
      'assigned',
      'owned',
      'available',
    ]);
  });

  it('groups unpositioned tables and filters blocked entries', () => {
    const tables = [
      makeTable({ id: 'a', section: 'Main', zoneId: 'zone-a' }),
      makeTable({ id: 'b', section: 'Main', zoneId: 'zone-a' }),
      makeTable({ id: 'held', section: 'Patio', zoneId: 'zone-b' }),
    ];

    const layout = deriveTableFloorPlanLayout({
      bookingAssignments: [],
      bookingId: 'booking-1',
      conflicts: [],
      holds: [makeHold({ bookingId: 'booking-2', id: 'hold-other', tableIds: ['held'] })],
      onlyAvailable: true,
      selectedTableIds: ['a'],
      tables,
    });

    expect(layout.unpositioned.map((table) => table.id)).toEqual(['a', 'b']);
    expect(layout.groupedUnpositioned).toEqual([
      { section: 'Main', tables: [tables[0], tables[1]], zoneId: 'zone-a' },
    ]);
  });

  it('formats countdowns defensively', () => {
    expect(formatFloorPlanCountdown(125)).toBe('02:05');
    expect(formatFloorPlanCountdown(-1)).toBe('00:00');
    expect(formatFloorPlanCountdown(null)).toBeNull();
  });
});

function makeTable(
  overrides: Partial<ManualAssignmentTable> & { id: string },
): ManualAssignmentTable {
  return {
    active: overrides.active ?? true,
    capacity: overrides.capacity ?? 4,
    category: overrides.category ?? 'standard',
    id: overrides.id,
    maxPartySize: overrides.maxPartySize ?? 8,
    minPartySize: overrides.minPartySize ?? 1,
    mobility: overrides.mobility ?? 'standard',
    name: overrides.name ?? null,
    position: overrides.position ?? null,
    seatingType: overrides.seatingType ?? 'standard',
    section: overrides.section ?? null,
    status: overrides.status ?? 'available',
    tableNumber: overrides.tableNumber ?? overrides.id,
    zoneActive: overrides.zoneActive ?? true,
    zoneId: overrides.zoneId ?? 'zone-main',
  };
}

function makeHold(
  overrides: Partial<ManualAssignmentContextHold> & { id: string; tableIds: string[] },
): ManualAssignmentContextHold {
  return {
    bookingId: overrides.bookingId ?? null,
    countdownSeconds: overrides.countdownSeconds ?? null,
    createdBy: overrides.createdBy ?? null,
    createdByEmail: overrides.createdByEmail ?? null,
    createdByName: overrides.createdByName ?? null,
    endAt: overrides.endAt ?? '2026-05-20T20:00:00.000Z',
    expiresAt: overrides.expiresAt ?? '2026-05-20T19:45:00.000Z',
    id: overrides.id,
    metadata: overrides.metadata ?? null,
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    startAt: overrides.startAt ?? '2026-05-20T19:00:00.000Z',
    tableIds: overrides.tableIds,
    zoneId: overrides.zoneId ?? 'zone-main',
  };
}

function makeConflict(overrides: Partial<ManualAssignmentConflict> & { tableId: string }) {
  return {
    bookingId: overrides.bookingId ?? 'booking-conflict',
    endAt: overrides.endAt ?? '2026-05-20T20:00:00.000Z',
    startAt: overrides.startAt ?? '2026-05-20T19:00:00.000Z',
    status: overrides.status ?? 'confirmed',
    tableId: overrides.tableId,
  } satisfies ManualAssignmentConflict;
}
