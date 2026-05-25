import type {
  ManualAssignmentConflict,
  ManualAssignmentContextHold,
  ManualAssignmentTable,
} from '@/services/ops/bookings';

export type FloorPlanTableVariant =
  | 'selected'
  | 'owned'
  | 'blocked'
  | 'assigned'
  | 'inactive'
  | 'default';

export type FloorPlanTable = {
  table: ManualAssignmentTable;
  xPercent: number;
  yPercent: number;
  rotation: number;
  holdOwned: ManualAssignmentContextHold | null;
  holdOther: ManualAssignmentContextHold | null;
  conflicts: ManualAssignmentConflict[];
  isAssignedToBooking: boolean;
  isSelected: boolean;
  isInactive: boolean;
};

export type FloorPlanUnpositionedGroup = {
  zoneId: string | null;
  section: string | null;
  tables: ManualAssignmentTable[];
};

export type FloorPlanUnpositionedTableState = {
  isSelected: boolean;
  holdOther: ManualAssignmentContextHold | null;
  hasConflict: boolean;
  isInactive: boolean;
  isBlocked: boolean;
};

export type TableFloorPlanLayout = {
  positioned: FloorPlanTable[];
  unpositioned: ManualAssignmentTable[];
  groupedUnpositioned: FloorPlanUnpositionedGroup[];
};

export function deriveTableFloorPlanLayout({
  bookingAssignments,
  bookingId,
  conflicts,
  holds,
  onlyAvailable,
  selectedTableIds,
  tables,
}: {
  bookingId: string;
  tables: ManualAssignmentTable[];
  holds: ManualAssignmentContextHold[];
  conflicts: ManualAssignmentConflict[];
  bookingAssignments: string[];
  selectedTableIds: string[];
  onlyAvailable: boolean;
}): TableFloorPlanLayout {
  const bookingAssignmentSet = new Set(bookingAssignments);
  const selectedTableIdSet = new Set(selectedTableIds);
  const conflictTableIds = new Set(conflicts.map((conflict) => conflict.tableId));
  const { positioned, unpositioned } = computeFloorPlanLayout({
    bookingAssignmentSet,
    bookingId,
    conflicts,
    holds,
    selectedTableIdSet,
    tables,
  });

  if (!onlyAvailable) {
    return {
      groupedUnpositioned: groupUnpositionedTables(unpositioned),
      positioned,
      unpositioned,
    };
  }

  const filteredPositioned = positioned.filter((entry) => {
    if (entry.isAssignedToBooking || entry.holdOwned) return true;
    return !entry.isInactive && !entry.holdOther && entry.conflicts.length === 0;
  });

  const filteredUnpositioned = unpositioned.filter((table) => {
    const state = deriveUnpositionedTableState({
      bookingId,
      conflictTableIds,
      disabled: false,
      holds,
      selectedTableIdSet,
      table,
    });
    return !state.isBlocked || bookingAssignmentSet.has(table.id);
  });

  return {
    groupedUnpositioned: groupUnpositionedTables(filteredUnpositioned),
    positioned: filteredPositioned,
    unpositioned: filteredUnpositioned,
  };
}

export function deriveUnpositionedTableState({
  bookingId,
  conflictTableIds,
  disabled,
  holds,
  selectedTableIdSet,
  table,
}: {
  bookingId: string;
  conflictTableIds: Set<string>;
  disabled: boolean;
  holds: ManualAssignmentContextHold[];
  selectedTableIdSet: Set<string>;
  table: ManualAssignmentTable;
}): FloorPlanUnpositionedTableState {
  const isSelected = selectedTableIdSet.has(table.id);
  const tableHolds = holds.filter((hold) => hold.tableIds.includes(table.id));
  const holdOther =
    tableHolds.find((hold) => hold.bookingId && hold.bookingId !== bookingId) ?? null;
  const hasConflict = conflictTableIds.has(table.id);
  const isInactive = isTableInactive(table);

  return {
    hasConflict,
    holdOther,
    isBlocked: disabled || isInactive || Boolean(holdOther) || hasConflict,
    isInactive,
    isSelected,
  };
}

export function formatFloorPlanTableTitle(entry: FloorPlanTable): string {
  const { conflicts, holdOther, holdOwned, table } = entry;
  const lines: string[] = [
    table.name ? `Table ${table.tableNumber} - ${table.name}` : `Table ${table.tableNumber}`,
    `${table.capacity} seats`,
  ];
  if (holdOwned) {
    lines.push('Held by you');
  }
  if (holdOther) {
    lines.push(`Held by ${holdOther.createdByName ?? 'another staff member'}`);
  }
  if (conflicts.length > 0) {
    lines.push(
      `Blocked (${conflicts.length} overlapping booking${conflicts.length === 1 ? '' : 's'})`,
    );
  }
  if (isTableInactive(table)) {
    lines.push(`Status: ${table.status ?? 'inactive'}`);
  }
  return lines.join('\n');
}

export function formatFloorPlanTableAriaLabel({
  entry,
  isBlocked,
  isSelected,
}: {
  entry: FloorPlanTable;
  isSelected: boolean;
  isBlocked: boolean;
}): string {
  const parts: string[] = [];
  if (entry.table.name) {
    parts.push(`Table ${entry.table.tableNumber}, ${entry.table.name}`);
  } else {
    parts.push(`Table ${entry.table.tableNumber}`);
  }
  parts.push(`${entry.table.capacity} seats`);
  if (isSelected) parts.push('selected');
  if (isBlocked) parts.push('unavailable');
  if (entry.holdOwned) parts.push('held by you');
  if (entry.holdOther) parts.push('held by another booking');
  if (entry.conflicts.length > 0) {
    parts.push(`${entry.conflicts.length} conflict${entry.conflicts.length === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}

export function formatFloorPlanCountdown(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) {
    return null;
  }
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(clamped % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export function getFloorPlanTableVariant(entry: FloorPlanTable): FloorPlanTableVariant {
  if (entry.isInactive) {
    return 'inactive';
  }
  if (entry.isSelected) {
    return 'selected';
  }
  if (entry.holdOwned) {
    return 'owned';
  }
  if (entry.isAssignedToBooking) {
    return 'assigned';
  }
  if (entry.holdOther || entry.conflicts.length > 0) {
    return 'blocked';
  }
  return 'default';
}

export function formatUnpositionedTableAriaLabel({
  hasConflict,
  holdOther,
  isBlocked,
  isInactive,
  isSelected,
  table,
}: {
  table: ManualAssignmentTable;
  isSelected: boolean;
  isBlocked: boolean;
  holdOther: ManualAssignmentContextHold | null;
  hasConflict: boolean;
  isInactive: boolean;
}): string {
  return `Table ${table.tableNumber}${table.name ? `, ${table.name}` : ''}, ${table.capacity} seats${
    isSelected ? ', selected' : ''
  }${isBlocked ? ', unavailable' : ''}${holdOther ? ', held' : ''}${
    hasConflict ? ', conflict' : ''
  }${isInactive ? ', inactive' : ''}`;
}

function computeFloorPlanLayout({
  bookingAssignmentSet,
  bookingId,
  conflicts,
  holds,
  selectedTableIdSet,
  tables,
}: {
  bookingId: string;
  tables: ManualAssignmentTable[];
  holds: ManualAssignmentContextHold[];
  conflicts: ManualAssignmentConflict[];
  bookingAssignmentSet: Set<string>;
  selectedTableIdSet: Set<string>;
}): { positioned: FloorPlanTable[]; unpositioned: ManualAssignmentTable[] } {
  const conflictMap = new Map<string, ManualAssignmentConflict[]>();
  for (const conflict of conflicts) {
    const list = conflictMap.get(conflict.tableId) ?? [];
    list.push(conflict);
    conflictMap.set(conflict.tableId, list);
  }

  const holdMap = new Map<string, ManualAssignmentContextHold[]>();
  for (const hold of holds) {
    for (const tableId of hold.tableIds) {
      const list = holdMap.get(tableId) ?? [];
      list.push(hold);
      holdMap.set(tableId, list);
    }
  }

  const positionedEntities: Array<{
    table: ManualAssignmentTable;
    position: { x: number; y: number; rotation: number };
  }> = [];
  const fallback: ManualAssignmentTable[] = [];

  for (const table of tables) {
    const position = normalizePosition(table.position);
    if (position) {
      positionedEntities.push({ position, table });
    } else {
      fallback.push(table);
    }
  }

  if (positionedEntities.length === 0) {
    return { positioned: [], unpositioned: fallback.length > 0 ? fallback : tables };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const entity of positionedEntities) {
    minX = Math.min(minX, entity.position.x);
    maxX = Math.max(maxX, entity.position.x);
    minY = Math.min(minY, entity.position.y);
    maxY = Math.max(maxY, entity.position.y);
  }

  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);

  const positioned = positionedEntities.map(({ position, table }) => {
    const tableHolds = holdMap.get(table.id) ?? [];
    const holdOwned = tableHolds.find((hold) => hold.bookingId === bookingId) ?? null;
    const holdOther =
      tableHolds.find((hold) => hold.bookingId && hold.bookingId !== bookingId) ?? null;

    return {
      conflicts: conflictMap.get(table.id) ?? [],
      holdOther,
      holdOwned,
      isAssignedToBooking: bookingAssignmentSet.has(table.id),
      isInactive: isTableInactive(table),
      isSelected: selectedTableIdSet.has(table.id),
      rotation: position.rotation ?? 0,
      table,
      xPercent: ((position.x - minX) / rangeX) * 100,
      yPercent: ((position.y - minY) / rangeY) * 100,
    };
  });

  return { positioned, unpositioned: fallback };
}

function groupUnpositionedTables(tables: ManualAssignmentTable[]): FloorPlanUnpositionedGroup[] {
  const groups = new Map<string, FloorPlanUnpositionedGroup>();
  for (const table of tables) {
    const key = `${table.zoneId ?? 'unknown'}::${table.section ?? 'unassigned'}`;
    const current = groups.get(key);
    if (current) {
      current.tables.push(table);
    } else {
      groups.set(key, {
        section: table.section ?? null,
        tables: [table],
        zoneId: table.zoneId ?? null,
      });
    }
  }
  return Array.from(groups.values());
}

function normalizePosition(value: unknown): { x: number; y: number; rotation: number } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const x = typeof record.x === 'number' ? record.x : null;
  const y = typeof record.y === 'number' ? record.y : null;
  if (x === null || y === null) {
    return null;
  }
  const rotation = typeof record.rotation === 'number' ? record.rotation : 0;
  return { rotation, x, y };
}

function isTableInactive(table: ManualAssignmentTable): boolean {
  return (
    !table.active ||
    table.zoneActive === false ||
    (table.status ?? '').toString().toLowerCase() !== 'available'
  );
}
