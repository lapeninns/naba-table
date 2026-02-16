import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

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
});
