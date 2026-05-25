import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/feature-flags', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getAllocatorAdjacencyMode: () => 'connected',
    getManualAssignmentMaxSlack: () => 2,
  };
});

import {
  buildManualChecks,
  findUnavailableTables,
  resolveManualSlackBudget,
} from '@/server/capacity/table-assignment/manual-checks';
import { summarizeSelection } from '@/server/capacity/table-assignment/utils';

import type { HoldConflictInfo } from '@/server/capacity/holds';
import type {
  ManualAssignmentConflict,
  ManualSelectionCheck,
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
    status: overrides.status ?? 'available',
    zoneActive: overrides.zoneActive ?? true,
  };
}

function getCheck(checks: ManualSelectionCheck[], id: ManualSelectionCheck['id']) {
  const check = checks.find((candidate) => candidate.id === id);
  expect(check).toBeDefined();
  return check!;
}

describe('manual table assignment checks', () => {
  it('identifies inactive, disabled-zone, and out-of-service tables', () => {
    const unavailable = findUnavailableTables([
      makeTable({ id: 'active' }),
      makeTable({ id: 'inactive', active: false }),
      makeTable({ id: 'zone-disabled', zoneActive: false }),
      makeTable({ id: 'out', status: 'OUT_OF_SERVICE' }),
    ]);

    expect(unavailable.map((table) => table.id)).toEqual(['inactive', 'zone-disabled', 'out']);
  });

  it('uses the manual assignment slack override when configured', () => {
    expect(resolveManualSlackBudget()).toBe(2);
  });

  it('builds successful checks for adjacent movable tables without conflicts', () => {
    const tables = [
      makeTable({ id: 'table-1', tableNumber: '1' }),
      makeTable({ id: 'table-2', tableNumber: '2' }),
    ];
    const checks = buildManualChecks({
      adjacency: new Map([
        ['table-1', new Set(['table-2'])],
        ['table-2', new Set(['table-1'])],
      ]),
      conflicts: [],
      holdConflicts: [],
      requireAdjacency: true,
      slackBudget: 2,
      summary: summarizeSelection(tables, 4),
      tables,
    });

    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ['active', 'ok'],
      ['capacity', 'ok'],
      ['slack', 'ok'],
      ['zone', 'ok'],
      ['movable', 'ok'],
      ['adjacency', 'ok'],
      ['conflict', 'ok'],
      ['holds', 'ok'],
    ]);
  });

  it('reports capacity, slack, zone, movable, adjacency, assignment, and hold failures', () => {
    const tables = [
      makeTable({ id: 'table-1', capacity: 4, mobility: 'fixed', zoneId: 'zone-1' }),
      makeTable({ id: 'table-2', capacity: 4, mobility: 'movable', zoneId: 'zone-2' }),
    ];
    const assignmentConflict: ManualAssignmentConflict = {
      bookingId: 'booking-1',
      endAt: '2026-05-23T19:00:00Z',
      source: 'booking',
      startAt: '2026-05-23T18:00:00Z',
      tableId: 'table-1',
    };
    const holdConflict = {
      bookingId: 'booking-2',
      endAt: '2026-05-23T19:00:00Z',
      holdId: 'hold-1',
      startAt: '2026-05-23T18:00:00Z',
      tableId: 'table-2',
    } as HoldConflictInfo;

    const checks = buildManualChecks({
      adjacency: new Map(),
      conflicts: [assignmentConflict],
      holdConflicts: [holdConflict],
      requireAdjacency: true,
      slackBudget: 1,
      summary: summarizeSelection(tables, 3),
      tables,
    });

    expect(getCheck(checks, 'capacity').status).toBe('ok');
    expect(getCheck(checks, 'slack')).toMatchObject({
      status: 'error',
      message: 'Selection exceeds slack budget (allowed 1, actual 5)',
    });
    expect(getCheck(checks, 'zone')).toMatchObject({
      status: 'error',
      message: 'Tables must belong to the same zone for manual assignment',
    });
    expect(getCheck(checks, 'movable')).toMatchObject({
      status: 'error',
      message: 'Merged assignments require movable tables',
    });
    expect(getCheck(checks, 'adjacency')).toMatchObject({
      status: 'error',
      message: 'Tables must remain connected when adjacency enforcement is enabled',
    });
    expect(getCheck(checks, 'conflict')).toMatchObject({
      status: 'error',
      message: 'Existing assignments or holds conflict with selection',
    });
    expect(getCheck(checks, 'holds')).toMatchObject({
      status: 'error',
      message: 'Tables currently on hold',
    });
  });
});
