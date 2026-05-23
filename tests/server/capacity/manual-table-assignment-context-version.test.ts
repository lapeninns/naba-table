import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  buildAdjacencyVersion,
  buildAssignmentsVersion,
  buildHoldsVersion,
  buildManualAssignmentContextVersions,
  buildTableVersion,
} from '@/server/capacity/table-assignment/context-version';

import type {
  BookingWindow,
  ManualAssignmentContextHold,
  Table,
} from '@/server/capacity/table-assignment/types';

function makeTable(overrides: Partial<Table> & { id: string }): Table {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id,
    capacity: overrides.capacity ?? 2,
    zoneId: overrides.zoneId ?? 'zone-1',
    active: overrides.active ?? true,
    mobility: overrides.mobility ?? 'movable',
    category: overrides.category ?? 'dining',
    seatingType: overrides.seatingType ?? 'standard',
  };
}

function makeHold(overrides: Partial<ManualAssignmentContextHold> & { id: string }) {
  return {
    id: overrides.id,
    bookingId: overrides.bookingId ?? 'booking-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    zoneId: overrides.zoneId ?? 'zone-1',
    tableIds: overrides.tableIds ?? ['table-1'],
    startAt: overrides.startAt ?? '2026-05-23T18:00:00Z',
    endAt: overrides.endAt ?? '2026-05-23T19:30:00Z',
    expiresAt: overrides.expiresAt ?? '2026-05-23T18:10:00Z',
    createdBy: overrides.createdBy ?? 'user-1',
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? '2026-05-23T17:55:00Z',
    tableNumbers: overrides.tableNumbers ?? ['1'],
  } as ManualAssignmentContextHold;
}

const window = {
  block: {
    start: DateTime.fromISO('2026-05-23T18:00:00Z'),
    end: DateTime.fromISO('2026-05-23T19:30:00Z'),
  },
} as BookingWindow;

describe('manual assignment context versions', () => {
  it('builds order-insensitive table, adjacency, hold, and assignment versions', () => {
    const tables = [
      makeTable({ id: 'table-2', capacity: 4 }),
      makeTable({ id: 'table-1', capacity: 2 }),
    ];
    const reversedTables = [...tables].reverse();
    const adjacency = new Map([
      ['table-2', new Set(['table-1', 'table-3'])],
      ['table-1', new Set(['table-2'])],
    ]);
    const reversedAdjacency = new Map([
      ['table-1', new Set(['table-2'])],
      ['table-2', new Set(['table-3', 'table-1'])],
    ]);
    const holds = [
      makeHold({ id: 'hold-2', tableIds: ['table-3', 'table-2'] }),
      makeHold({ id: 'hold-1', tableIds: ['table-1'] }),
    ];
    const reversedHolds = [
      makeHold({ id: 'hold-1', tableIds: ['table-1'] }),
      makeHold({ id: 'hold-2', tableIds: ['table-2', 'table-3'] }),
    ];

    expect(buildTableVersion(tables)).toBe(buildTableVersion(reversedTables));
    expect(buildAdjacencyVersion(adjacency)).toBe(buildAdjacencyVersion(reversedAdjacency));
    expect(buildHoldsVersion(holds)).toBe(buildHoldsVersion(reversedHolds));
    expect(buildAssignmentsVersion(['table-2', 'table-1'])).toBe(
      buildAssignmentsVersion(['table-1', 'table-2']),
    );
  });

  it('returns the aggregate context version and individual version components', () => {
    const versions = buildManualAssignmentContextVersions({
      adjacency: new Map([['table-1', new Set(['table-2'])]]),
      assignments: ['table-1'],
      flags: {
        adjacencyRequired: true,
        adjacencyUndirected: false,
        holdsStrictConflicts: true,
      },
      holds: [makeHold({ id: 'hold-1' })],
      policyVersion: 'policy-v1',
      tables: [makeTable({ id: 'table-1' })],
      window,
    });

    expect(versions).toEqual({
      context: expect.any(String),
      policy: 'policy-v1',
      window: expect.any(String),
      flags: expect.any(String),
      tables: expect.any(String),
      adjacency: expect.any(String),
      holds: expect.any(String),
      assignments: expect.any(String),
    });
    expect(versions.context).not.toBe(versions.tables);
  });
});
