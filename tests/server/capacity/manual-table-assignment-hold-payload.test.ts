import { describe, expect, it } from 'vitest';

import {
  buildManualHoldAdjacencySnapshot,
  buildManualTableHoldPayload,
} from '@/server/capacity/table-assignment/manual-hold-payload';

import type { ManualSelectionSummary, Table } from '@/server/capacity/table-assignment/types';

function makeTable(overrides: Partial<Table> & { id: string }): Table {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id,
    capacity: overrides.capacity ?? 2,
    zoneId: overrides.zoneId ?? 'zone-1',
    active: overrides.active ?? true,
    mobility: overrides.mobility ?? 'movable',
  };
}

const summary: ManualSelectionSummary = {
  partySize: 4,
  slack: 0,
  tableCount: 2,
  tableNumbers: ['1', '2'],
  totalCapacity: 4,
  zoneId: 'zone-1',
};

describe('manual table assignment hold payload', () => {
  it('builds a directed adjacency snapshot when adjacency is required', () => {
    const snapshot = buildManualHoldAdjacencySnapshot({
      adjacency: new Map([
        ['table-1', new Set(['table-2'])],
        ['table-2', new Set(['table-1', 'table-3'])],
      ]),
      adjacencyUndirected: false,
      requireAdjacency: true,
      tableIds: ['table-2', 'table-1'],
      tables: [makeTable({ id: 'table-1' }), makeTable({ id: 'table-2' })],
    });

    expect(snapshot).toEqual({
      zoneIds: ['zone-1'],
      adjacency: {
        undirected: false,
        edges: ['table-1->table-2', 'table-2->table-1'],
        hash: expect.any(String),
      },
    });
  });

  it('normalizes duplicate undirected adjacency edges', () => {
    const snapshot = buildManualHoldAdjacencySnapshot({
      adjacency: new Map([
        ['table-2', new Set(['table-1'])],
        ['table-1', new Set(['table-2'])],
      ]),
      adjacencyUndirected: true,
      requireAdjacency: true,
      tableIds: ['table-2', 'table-1'],
      tables: [makeTable({ id: 'table-2' }), makeTable({ id: 'table-1' })],
    });

    expect(snapshot?.adjacency.edges).toEqual(['table-1->table-2']);
  });

  it('omits the snapshot when adjacency is not required', () => {
    expect(
      buildManualHoldAdjacencySnapshot({
        adjacency: new Map([['table-1', new Set(['table-2'])]]),
        adjacencyUndirected: true,
        requireAdjacency: false,
        tableIds: ['table-1', 'table-2'],
        tables: [makeTable({ id: 'table-1' }), makeTable({ id: 'table-2' })],
      }),
    ).toBeNull();
  });

  it('builds the standard manual hold payload metadata shape', () => {
    const client = { from: () => ({}) } as never;
    const payload = buildManualTableHoldPayload({
      adjacency: new Map([['table-1', new Set(['table-2'])]]),
      adjacencyUndirected: false,
      bookingId: 'booking-1',
      client,
      createdBy: 'user-1',
      endAt: '2026-05-23T19:30:00Z',
      expiresAt: '2026-05-23T18:10:00Z',
      policyVersion: 'policy-v1',
      requireAdjacency: false,
      restaurantId: 'restaurant-1',
      startAt: '2026-05-23T18:00:00Z',
      summary,
      tableIds: ['table-1', 'table-2'],
      tables: [makeTable({ id: 'table-1' }), makeTable({ id: 'table-2' })],
      zoneId: 'zone-1',
    });

    expect(payload).toEqual({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      zoneId: 'zone-1',
      tableIds: ['table-1', 'table-2'],
      startAt: '2026-05-23T18:00:00Z',
      endAt: '2026-05-23T19:30:00Z',
      expiresAt: '2026-05-23T18:10:00Z',
      createdBy: 'user-1',
      metadata: {
        selection: {
          tableIds: ['table-1', 'table-2'],
          summary,
          snapshot: null,
        },
        policyVersion: 'policy-v1',
        requireAdjacency: false,
      },
      client,
    });
  });

  it('adds instant assignment metadata when requested', () => {
    const payload = buildManualTableHoldPayload({
      adjacency: new Map(),
      adjacencyUndirected: false,
      assignedBy: 'manager-1',
      bookingId: 'booking-1',
      client: {} as never,
      createdBy: 'user-1',
      endAt: '2026-05-23T19:30:00Z',
      expiresAt: '2026-05-23T18:10:00Z',
      instantAssignment: true,
      policyVersion: 'policy-v1',
      requireAdjacency: false,
      restaurantId: 'restaurant-1',
      startAt: '2026-05-23T18:00:00Z',
      summary,
      tableIds: ['table-1'],
      tables: [makeTable({ id: 'table-1' })],
      zoneId: 'zone-1',
    });

    expect(payload.metadata).toMatchObject({
      instantAssignment: true,
      assignedBy: 'manager-1',
    });
  });
});
