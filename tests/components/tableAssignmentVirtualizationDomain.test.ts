import { describe, expect, it } from 'vitest';

import {
  buildVirtualizedTableRows,
  buildVisibleTableIndexSet,
  findFirstVisibleFocusableIndex,
  findLastFocusableIndex,
  findNextFocusableIndex,
  resolveActiveFocusableIndex,
  resolveTableFocusability,
  resolveVirtualizedTableKeyboardAction,
  resolveVirtualizedTableTabIndex,
} from '@/components/features/dashboard/booking-details/tableAssignmentVirtualizationDomain';

import type { ManualAssignmentTable } from '@/components/features/dashboard/booking-details/types';

describe('tableAssignmentVirtualizationDomain', () => {
  it('packs grouped tables into section headers, virtual rows, and flat index lookups', () => {
    const groupedTables = new Map<string, ManualAssignmentTable[]>([
      ['Main', [table({ id: 't-1' }), table({ id: 't-2' }), table({ id: 't-3' })]],
      ['Patio', [table({ id: 't-4', status: 'conflicted' })]],
    ]);

    const result = buildVirtualizedTableRows({
      columns: 2,
      conflictedTableIds: new Set(['t-4']),
      groupedTables,
    });

    expect(result.rows).toEqual([
      { kind: 'header', section: 'Main', conflictCount: 0, tableCount: 3 },
      {
        kind: 'tables',
        tables: [expect.objectContaining({ id: 't-1' }), expect.any(Object)],
        startIndex: 0,
      },
      { kind: 'tables', tables: [expect.objectContaining({ id: 't-3' })], startIndex: 2 },
      { kind: 'header', section: 'Patio', conflictCount: 1, tableCount: 1 },
      { kind: 'tables', tables: [expect.objectContaining({ id: 't-4' })], startIndex: 3 },
    ]);
    expect(result.flatTables.map((tableItem) => tableItem.id)).toEqual([
      't-1',
      't-2',
      't-3',
      't-4',
    ]);
    expect(Array.from(result.tableIndexToRowIndex.entries())).toEqual([
      [0, 1],
      [1, 1],
      [2, 2],
      [3, 4],
    ]);
  });

  it('derives focusability from disabled, assigned, inactive, unavailable, and conflicted states', () => {
    const tables = [
      table({ id: 'available' }),
      table({ id: 'assigned' }),
      table({ id: 'inactive', active: false }),
      table({ id: 'reserved', status: 'reserved' }),
      table({ id: 'conflicted' }),
    ];

    expect(
      resolveTableFocusability({
        assignedTableIds: new Set(['assigned']),
        conflictedTableIds: new Set(['conflicted']),
        disabled: false,
        tables,
      }),
    ).toEqual([true, false, false, false, false]);

    expect(
      resolveTableFocusability({
        assignedTableIds: new Set<string>(),
        conflictedTableIds: new Set<string>(),
        disabled: true,
        tables: [table({ id: 'available' })],
      }),
    ).toEqual([false]);
  });

  it('resolves roving focus indexes for keyboard movement and active fallbacks', () => {
    const focusableByIndex = [false, true, false, true, false];

    expect(resolveActiveFocusableIndex({ activeIndex: 0, focusableByIndex })).toBe(1);
    expect(resolveActiveFocusableIndex({ activeIndex: 3, focusableByIndex })).toBe(3);
    expect(findNextFocusableIndex({ focusableByIndex, start: 1, step: 1 })).toBe(3);
    expect(findNextFocusableIndex({ focusableByIndex, start: 3, step: 1 })).toBe(3);
    expect(findNextFocusableIndex({ focusableByIndex, start: 3, step: -2 })).toBe(1);
    expect(findLastFocusableIndex(focusableByIndex)).toBe(3);
    expect(resolveActiveFocusableIndex({ activeIndex: 0, focusableByIndex: [false] })).toBe(0);
    expect(findLastFocusableIndex([false])).toBe(-1);
  });

  it('resolves visible table indexes and tabIndex fallback for virtualized rows', () => {
    const { rows } = buildVirtualizedTableRows({
      columns: 2,
      conflictedTableIds: new Set<string>(),
      groupedTables: new Map([
        ['Main', [table({ id: 't-1' }), table({ id: 't-2' }), table({ id: 't-3' })]],
      ]),
    });

    const visibleIndexSet = buildVisibleTableIndexSet({ rowIndexes: [0, 1], rows });
    const firstVisibleFocusable = findFirstVisibleFocusableIndex({
      focusableByIndex: [false, true, true],
      rowIndexes: [0, 1],
      rows,
    });

    expect(Array.from(visibleIndexSet)).toEqual([0, 1]);
    expect(firstVisibleFocusable).toBe(1);
    expect(
      resolveVirtualizedTableTabIndex({
        activeIndex: 2,
        firstVisibleFocusable,
        index: 1,
        visibleIndexSet,
      }),
    ).toBe(0);
    expect(
      resolveVirtualizedTableTabIndex({
        activeIndex: 1,
        firstVisibleFocusable,
        index: 1,
        visibleIndexSet,
      }),
    ).toBe(0);
    expect(
      resolveVirtualizedTableTabIndex({
        activeIndex: 1,
        firstVisibleFocusable,
        index: 0,
        visibleIndexSet,
      }),
    ).toBe(-1);
  });

  it('maps virtualized keyboard keys to focus and toggle actions', () => {
    const focusableByIndex = [true, false, true, true, false];

    expect(
      resolveVirtualizedTableKeyboardAction({
        columns: 2,
        focusableByIndex,
        index: 2,
        key: 'ArrowLeft',
        tableCount: focusableByIndex.length,
      }),
    ).toEqual({ kind: 'focus', index: 0 });
    expect(
      resolveVirtualizedTableKeyboardAction({
        columns: 2,
        focusableByIndex,
        index: 0,
        key: 'ArrowDown',
        tableCount: focusableByIndex.length,
      }),
    ).toEqual({ kind: 'focus', index: 2 });
    expect(
      resolveVirtualizedTableKeyboardAction({
        columns: 2,
        focusableByIndex,
        index: 2,
        key: 'End',
        tableCount: focusableByIndex.length,
      }),
    ).toEqual({ kind: 'focus', index: 3 });
    expect(
      resolveVirtualizedTableKeyboardAction({
        columns: 2,
        focusableByIndex: [false, false],
        index: 0,
        key: 'End',
        tableCount: 2,
      }),
    ).toEqual({ kind: 'focus', index: 1 });
    expect(
      resolveVirtualizedTableKeyboardAction({
        columns: 2,
        focusableByIndex,
        index: 2,
        key: ' ',
        tableCount: focusableByIndex.length,
      }),
    ).toEqual({ kind: 'toggle' });
    expect(
      resolveVirtualizedTableKeyboardAction({
        columns: 2,
        focusableByIndex,
        index: 2,
        key: 'Escape',
        tableCount: focusableByIndex.length,
      }),
    ).toEqual({ kind: 'none' });
  });
});

function table({
  active = true,
  capacity = 4,
  id,
  section = 'Main',
  status = 'available',
}: {
  active?: boolean;
  capacity?: number;
  id: string;
  section?: string | null;
  status?: string;
}): ManualAssignmentTable {
  return {
    active,
    capacity,
    category: 'standard',
    id,
    maxPartySize: capacity + 2,
    minPartySize: 1,
    mobility: 'standard',
    name: id,
    position: null,
    seatingType: 'standard',
    section,
    status,
    tableNumber: id,
    zoneActive: true,
    zoneId: 'zone-1',
  };
}
