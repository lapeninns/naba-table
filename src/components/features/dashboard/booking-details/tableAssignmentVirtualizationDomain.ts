import type { ManualAssignmentTable } from './types';

export type VirtualizedTableRow =
  | { kind: 'header'; section: string; conflictCount: number; tableCount: number }
  | { kind: 'tables'; tables: ManualAssignmentTable[]; startIndex: number };

export type VirtualizedTableRowsResult = {
  rows: VirtualizedTableRow[];
  tableIndexToRowIndex: Map<number, number>;
  flatTables: ManualAssignmentTable[];
};

export function buildVirtualizedTableRows({
  columns,
  conflictedTableIds,
  groupedTables,
}: {
  columns: number;
  conflictedTableIds: Set<string>;
  groupedTables: Map<string, ManualAssignmentTable[]>;
}): VirtualizedTableRowsResult {
  const nextRows: VirtualizedTableRow[] = [];
  const tableIndexToRowIndex = new Map<number, number>();
  const flatTables: ManualAssignmentTable[] = [];
  const safeColumns = Math.max(1, columns);
  let rowIndex = 0;

  groupedTables.forEach((sectionTables, section) => {
    const conflictCount = sectionTables.filter((table) => conflictedTableIds.has(table.id)).length;
    nextRows.push({
      kind: 'header',
      section,
      conflictCount,
      tableCount: sectionTables.length,
    });
    rowIndex += 1;

    for (let index = 0; index < sectionTables.length; index += safeColumns) {
      const tables = sectionTables.slice(index, index + safeColumns);
      const startIndex = flatTables.length;
      flatTables.push(...tables);
      nextRows.push({ kind: 'tables', tables, startIndex });
      tables.forEach((_, offset) => tableIndexToRowIndex.set(startIndex + offset, rowIndex));
      rowIndex += 1;
    }
  });

  return { rows: nextRows, tableIndexToRowIndex, flatTables };
}

export function resolveTableFocusability({
  assignedTableIds,
  conflictedTableIds,
  disabled,
  tables,
}: {
  assignedTableIds: Set<string>;
  conflictedTableIds: Set<string>;
  disabled: boolean;
  tables: ManualAssignmentTable[];
}): boolean[] {
  return tables.map((table) => {
    const isConflicted = conflictedTableIds.has(table.id) || table.status === 'conflicted';
    const isUnavailable = isConflicted || !table.active || table.status !== 'available';
    const isAssigned = assignedTableIds.has(table.id);
    return !(disabled || isUnavailable || isAssigned);
  });
}

export function resolveActiveFocusableIndex({
  activeIndex,
  focusableByIndex,
}: {
  activeIndex: number;
  focusableByIndex: boolean[];
}): number {
  if (focusableByIndex[activeIndex]) return activeIndex;
  const first = focusableByIndex.findIndex(Boolean);
  return first === -1 ? 0 : first;
}

export function findNextFocusableIndex({
  focusableByIndex,
  start,
  step,
}: {
  focusableByIndex: boolean[];
  start: number;
  step: number;
}): number {
  if (step === 0) return start;
  let index = start + step;
  while (index >= 0 && index < focusableByIndex.length) {
    if (focusableByIndex[index]) return index;
    index += step;
  }
  return start;
}

export function findLastFocusableIndex(focusableByIndex: boolean[]): number {
  for (let index = focusableByIndex.length - 1; index >= 0; index -= 1) {
    if (focusableByIndex[index]) return index;
  }
  return -1;
}

export type VirtualizedTableKeyboardAction =
  | { kind: 'focus'; index: number }
  | { kind: 'toggle' }
  | { kind: 'none' };

export function resolveVirtualizedTableKeyboardAction({
  columns,
  focusableByIndex,
  index,
  key,
  tableCount,
}: {
  columns: number;
  focusableByIndex: boolean[];
  index: number;
  key: string;
  tableCount: number;
}): VirtualizedTableKeyboardAction {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'arrowleft') {
    return {
      kind: 'focus',
      index: findNextFocusableIndex({ focusableByIndex, start: index, step: -1 }),
    };
  }
  if (normalizedKey === 'arrowright') {
    return {
      kind: 'focus',
      index: findNextFocusableIndex({ focusableByIndex, start: index, step: 1 }),
    };
  }
  if (normalizedKey === 'arrowup') {
    return {
      kind: 'focus',
      index: findNextFocusableIndex({
        focusableByIndex,
        start: index,
        step: -Math.max(1, columns),
      }),
    };
  }
  if (normalizedKey === 'arrowdown') {
    return {
      kind: 'focus',
      index: findNextFocusableIndex({
        focusableByIndex,
        start: index,
        step: Math.max(1, columns),
      }),
    };
  }
  if (normalizedKey === 'home') {
    const first = focusableByIndex.findIndex(Boolean);
    return { kind: 'focus', index: first === -1 ? 0 : first };
  }
  if (normalizedKey === 'end') {
    const last = findLastFocusableIndex(focusableByIndex);
    return { kind: 'focus', index: last === -1 ? Math.max(0, tableCount - 1) : last };
  }
  if (normalizedKey === 'enter' || key === ' ') {
    return { kind: 'toggle' };
  }
  return { kind: 'none' };
}

export function buildVisibleTableIndexSet({
  rowIndexes,
  rows,
}: {
  rowIndexes: number[];
  rows: VirtualizedTableRow[];
}): Set<number> {
  const visibleIndexes = new Set<number>();
  rowIndexes.forEach((rowIndex) => {
    const item = rows[rowIndex];
    if (item?.kind !== 'tables') return;
    item.tables.forEach((_, offset) => visibleIndexes.add(item.startIndex + offset));
  });
  return visibleIndexes;
}

export function findFirstVisibleFocusableIndex({
  focusableByIndex,
  rowIndexes,
  rows,
}: {
  focusableByIndex: boolean[];
  rowIndexes: number[];
  rows: VirtualizedTableRow[];
}): number {
  for (const rowIndex of rowIndexes) {
    const item = rows[rowIndex];
    if (!item || item.kind !== 'tables') continue;
    for (let offset = 0; offset < item.tables.length; offset += 1) {
      const index = item.startIndex + offset;
      if (focusableByIndex[index]) return index;
    }
  }
  return -1;
}

export function resolveVirtualizedTableTabIndex({
  activeIndex,
  firstVisibleFocusable,
  index,
  visibleIndexSet,
}: {
  activeIndex: number;
  firstVisibleFocusable: number;
  index: number;
  visibleIndexSet: Set<number>;
}): 0 | -1 {
  if (index === activeIndex) return 0;
  if (!visibleIndexSet.has(activeIndex) && index === firstVisibleFocusable) return 0;
  return -1;
}
