import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getSelectorScoringConfig } from '@/server/capacity/policy';
import { buildScoredTablePlans } from '@/server/capacity/selector';
import { filterAvailableTables, type TableFilterDiagnostics } from '@/server/capacity/table-assignment/availability';

import type { BookingWindow, Table } from '@/server/capacity/table-assignment/types';

function createWindow(startOffsetMinutes: number, durationMinutes = 90): BookingWindow {
  const start = DateTime.utc().plus({ minutes: startOffsetMinutes });
  const end = start.plus({ minutes: durationMinutes });
  return {
    service: 'dinner',
    durationMinutes,
    dining: { start, end },
    block: { start, end },
    clampedToServiceEnd: false,
  };
}

function createTables(): Table[] {
  return [
    {
      id: 't-available',
      tableNumber: '01',
      capacity: 4,
      mobility: 'movable',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'available',
    },
    {
      id: 't-occupied',
      tableNumber: '02',
      capacity: 4,
      mobility: 'movable',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'occupied',
    },
    {
      id: 't-reserved',
      tableNumber: '03',
      capacity: 4,
      mobility: 'movable',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'reserved',
    },
    {
      id: 't-out-of-service',
      tableNumber: '04',
      capacity: 4,
      mobility: 'movable',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'out_of_service',
    },
  ];
}

function createAdjacency(tables: Table[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const table of tables) {
    adjacency.set(table.id, new Set<string>());
  }
  return adjacency;
}

function createFullyConnectedAdjacency(tables: Table[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const table of tables) {
    const neighbors = new Set<string>();
    for (const candidate of tables) {
      if (candidate.id !== table.id) {
        neighbors.add(candidate.id);
      }
    }
    adjacency.set(table.id, neighbors);
  }
  return adjacency;
}

describe('filterAvailableTables status policy', () => {
  it('allows occupied/reserved tables for future windows and only blocks out-of-service', () => {
    const tables = createTables();
    const adjacency = createAdjacency(tables);
    let diagnostics: TableFilterDiagnostics | null = null;

    const filtered = filterAvailableTables(
      tables,
      2,
      createWindow(120),
      adjacency,
      undefined,
      'zone-1',
      {
        captureDiagnostics: (stats) => {
          diagnostics = stats;
        },
      },
    );

    expect(filtered.map((table) => table.id)).toEqual(['t-available', 't-occupied', 't-reserved']);
    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.statusPolicy).toBe('exclude_out_of_service');
    expect(diagnostics?.futureWindow).toBe(true);
    expect(diagnostics?.droppedByStatus).toBe(1);
  });

  it('keeps available-only policy for near-now windows', () => {
    const tables = createTables();
    const adjacency = createAdjacency(tables);
    let diagnostics: TableFilterDiagnostics | null = null;

    const filtered = filterAvailableTables(
      tables,
      2,
      createWindow(-15),
      adjacency,
      undefined,
      'zone-1',
      {
        captureDiagnostics: (stats) => {
          diagnostics = stats;
        },
      },
    );

    expect(filtered.map((table) => table.id)).toEqual(['t-available']);
    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.statusPolicy).toBe('available_only');
    expect(diagnostics?.futureWindow).toBe(false);
    expect(diagnostics?.droppedByStatus).toBe(3);
  });

  it('does not require adjacency metadata for single-table fits', () => {
    const table: Table = {
      id: 'single-no-adj',
      tableNumber: '09',
      capacity: 4,
      mobility: 'fixed',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'available',
    };

    const filtered = filterAvailableTables(
      [table],
      4,
      createWindow(30),
      new Map<string, Set<string>>(),
      undefined,
      'zone-1',
    );

    expect(filtered.map((candidate) => candidate.id)).toEqual(['single-no-adj']);
  });

  it('treats legacy mobility values as mergeable when deriving filter rules', () => {
    const tables: Table[] = [
      {
        id: 'legacy-null-mobility',
        tableNumber: '11',
        capacity: 2,
        mobility: null,
        zoneId: 'zone-1',
        zoneActive: true,
        active: true,
        status: 'available',
      },
      {
        id: 'movable-companion',
        tableNumber: '12',
        capacity: 2,
        mobility: 'movable',
        zoneId: 'zone-1',
        zoneActive: true,
        active: true,
        status: 'available',
      },
    ];

    const adjacency = createAdjacency(tables);
    const filtered = filterAvailableTables(
      tables,
      4,
      createWindow(120),
      adjacency,
      undefined,
      'zone-1',
      {
        allowInsufficientCapacity: true,
        allowMaxPartySizeViolation: true,
      },
    );

    expect(filtered.map((table) => table.id)).toEqual(['legacy-null-mobility', 'movable-companion']);
  });

  it('keeps future-window capacity candidates so planner can still find a feasible merge', () => {
    const tables: Table[] = [
      {
        id: 'future-available-2',
        tableNumber: '01',
        capacity: 2,
        mobility: 'movable',
        zoneId: 'zone-1',
        zoneActive: true,
        active: true,
        status: 'available',
      },
      {
        id: 'future-occupied-4',
        tableNumber: '02',
        capacity: 4,
        mobility: 'movable',
        zoneId: 'zone-1',
        zoneActive: true,
        active: true,
        status: 'occupied',
      },
      {
        id: 'future-reserved-4',
        tableNumber: '03',
        capacity: 4,
        mobility: 'movable',
        zoneId: 'zone-1',
        zoneActive: true,
        active: true,
        status: 'reserved',
      },
      {
        id: 'future-out-of-service-8',
        tableNumber: '04',
        capacity: 8,
        mobility: 'movable',
        zoneId: 'zone-1',
        zoneActive: true,
        active: true,
        status: 'out_of_service',
      },
    ];
    const adjacency = createFullyConnectedAdjacency(tables);
    const filtered = filterAvailableTables(
      tables,
      6,
      createWindow(180),
      adjacency,
      undefined,
      'zone-1',
      {
        allowInsufficientCapacity: true,
        allowMaxPartySizeViolation: true,
      },
    );
    const planResult = buildScoredTablePlans({
      tables: filtered,
      partySize: 6,
      adjacency: createFullyConnectedAdjacency(filtered),
      config: getSelectorScoringConfig(),
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 2,
    });

    expect(filtered.map((table) => table.id)).toEqual([
      'future-available-2',
      'future-occupied-4',
      'future-reserved-4',
    ]);
    expect(planResult.plans.length).toBeGreaterThan(0);
    expect(planResult.fallbackReason).toBeUndefined();
  });
});
