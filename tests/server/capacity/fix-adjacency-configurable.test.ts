import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  filterAvailableTables,
  partiesRequireAdjacency,
  resolveRequireAdjacency,
  type TableFilterDiagnostics,
} from '@/server/capacity/table-assignment/availability';

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

// Two small movable tables that can ONLY satisfy the party by merging, with NO
// adjacency evidence between them. When adjacency is required they must be dropped
// as merge candidates; when adjacency is relaxed they survive the filter.
function createMergeOnlyTables(): Table[] {
  return [
    {
      id: 'merge-a',
      tableNumber: '01',
      capacity: 2,
      mobility: 'movable',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'available',
    },
    {
      id: 'merge-b',
      tableNumber: '02',
      capacity: 2,
      mobility: 'movable',
      zoneId: 'zone-1',
      zoneActive: true,
      active: true,
      status: 'available',
    },
  ];
}

describe('#13 adjacency-required is configurable (defaults to true)', () => {
  it('resolveRequireAdjacency honors an explicit override and defaults to true', () => {
    expect(resolveRequireAdjacency(8)).toBe(true);
    expect(resolveRequireAdjacency(8, false)).toBe(false);
    expect(resolveRequireAdjacency(8, true)).toBe(true);
  });

  it('partiesRequireAdjacency honors an explicit override and defaults to true', () => {
    expect(partiesRequireAdjacency(8)).toBe(true);
    expect(partiesRequireAdjacency(8, false)).toBe(false);
    expect(partiesRequireAdjacency(8, true)).toBe(true);
  });

  it('default behavior (no override) drops merge candidates lacking adjacency evidence', () => {
    const tables = createMergeOnlyTables();
    let diagnostics: TableFilterDiagnostics | null = null;

    const filtered = filterAvailableTables(
      tables,
      4, // requires merging the two 2-tops
      createWindow(120),
      new Map<string, Set<string>>(), // no adjacency evidence
      undefined,
      'zone-1',
      {
        allowInsufficientCapacity: true,
        allowMaxPartySizeViolation: true,
        captureDiagnostics: (stats) => {
          diagnostics = stats;
        },
      },
    );

    expect(filtered).toHaveLength(0);
    expect(diagnostics?.droppedByAdjacency).toBe(2);
  });

  it('override requireAdjacency=false relaxes the adjacency requirement for merge candidates', () => {
    const tables = createMergeOnlyTables();
    let diagnostics: TableFilterDiagnostics | null = null;

    const filtered = filterAvailableTables(
      tables,
      4,
      createWindow(120),
      new Map<string, Set<string>>(), // still no adjacency evidence
      undefined,
      'zone-1',
      {
        allowInsufficientCapacity: true,
        allowMaxPartySizeViolation: true,
        requireAdjacency: false,
        captureDiagnostics: (stats) => {
          diagnostics = stats;
        },
      },
    );

    expect(filtered.map((table) => table.id).sort()).toEqual(['merge-a', 'merge-b']);
    expect(diagnostics?.droppedByAdjacency).toBe(0);
  });

  it('explicit override requireAdjacency=true matches the default (still drops merges without evidence)', () => {
    const tables = createMergeOnlyTables();

    const filtered = filterAvailableTables(
      tables,
      4,
      createWindow(120),
      new Map<string, Set<string>>(),
      undefined,
      'zone-1',
      {
        allowInsufficientCapacity: true,
        allowMaxPartySizeViolation: true,
        requireAdjacency: true,
      },
    );

    expect(filtered).toHaveLength(0);
  });
});
