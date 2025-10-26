'use client';

import { memo, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type {
  ManualAssignmentConflict,
  ManualAssignmentContextHold,
  ManualAssignmentTable,
} from '@/services/ops/bookings';

type TableFloorPlanProps = {
  bookingId: string;
  tables: ManualAssignmentTable[];
  holds: ManualAssignmentContextHold[];
  conflicts: ManualAssignmentConflict[];
  bookingAssignments: string[];
  selectedTableIds: string[];
  onToggle: (tableId: string) => void;
  disabled?: boolean;
  className?: string;
};

type DerivedTable = {
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

const TABLE_SIZE_PX = 64;

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
  return { x, y, rotation };
}

function formatTableTitle(entry: DerivedTable): string {
  const { table, holdOwned, holdOther, conflicts } = entry;
  const lines: string[] = [
    `Table ${table.tableNumber}`,
    `${table.capacity} seats`,
  ];
  if (holdOwned) {
    lines.push('Held by you');
  }
  if (holdOther) {
    lines.push(`Held by ${holdOther.createdByName ?? 'another staff member'}`);
  }
  if (conflicts.length > 0) {
    lines.push(`Blocked (${conflicts.length} overlapping booking${conflicts.length === 1 ? '' : 's'})`);
  }
  if (!table.active || (table.status && table.status !== 'available')) {
    lines.push(`Status: ${table.status ?? 'inactive'}`);
  }
  return lines.join('\n');
}

function formatCountdown(seconds: number | null): string | null {
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

function computeLayout(
  bookingId: string,
  tables: ManualAssignmentTable[],
  holds: ManualAssignmentContextHold[],
  conflicts: ManualAssignmentConflict[],
  bookingAssignments: Set<string>,
  selectedTableIds: Set<string>,
): { positioned: DerivedTable[]; unpositioned: ManualAssignmentTable[] } {
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

  const positionedEntities: Array<{ table: ManualAssignmentTable; position: { x: number; y: number; rotation: number } }>
    = [];
  const fallback: ManualAssignmentTable[] = [];

  for (const table of tables) {
    const position = normalizePosition(table.position);
    if (position) {
      positionedEntities.push({ table, position });
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

  const derived: DerivedTable[] = positionedEntities.map(({ table, position }) => {
    const tableHolds = holdMap.get(table.id) ?? [];
    const holdOwned = tableHolds.find((hold) => hold.bookingId === bookingId) ?? null;
    const holdOther = tableHolds.find((hold) => hold.bookingId && hold.bookingId !== bookingId) ?? null;

    return {
      table,
      xPercent: ((position.x - minX) / rangeX) * 100,
      yPercent: ((position.y - minY) / rangeY) * 100,
      rotation: position.rotation ?? 0,
      holdOwned,
      holdOther,
      conflicts: conflictMap.get(table.id) ?? [],
      isAssignedToBooking: bookingAssignments.has(table.id),
      isSelected: selectedTableIds.has(table.id),
      isInactive: !table.active || (table.status ? table.status !== 'available' : false),
    };
  });

  return { positioned: derived, unpositioned: fallback };
}

function getVariant(entry: DerivedTable): 'selected' | 'owned' | 'blocked' | 'assigned' | 'inactive' | 'default' {
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

function getVariantClasses(variant: ReturnType<typeof getVariant>): string {
  switch (variant) {
    case 'selected':
      return 'bg-primary text-primary-foreground border-primary shadow-sm';
    case 'owned':
      return 'bg-blue-100 text-blue-900 border-blue-300';
    case 'assigned':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'blocked':
      return 'bg-amber-50 text-amber-900 border-amber-400';
    case 'inactive':
      return 'bg-muted text-muted-foreground border-muted-foreground/30 opacity-70';
    default:
      return 'bg-background text-foreground border-border';
  }
}

export const TableFloorPlan = memo(function TableFloorPlan({
  bookingId,
  tables,
  holds,
  conflicts,
  bookingAssignments,
  selectedTableIds,
  onToggle,
  disabled = false,
  className,
}: TableFloorPlanProps) {
  const bookingAssignmentSet = useMemo(() => new Set(bookingAssignments), [bookingAssignments]);
  const selectionSet = useMemo(() => new Set(selectedTableIds), [selectedTableIds]);

  const { positioned, unpositioned } = useMemo(
    () => computeLayout(bookingId, tables, holds, conflicts, bookingAssignmentSet, selectionSet),
    [bookingId, tables, holds, conflicts, bookingAssignmentSet, selectionSet],
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-muted/20" style={{ minHeight: positioned.length > 0 ? 320 : 180 }}>
        {positioned.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            No floor plan coordinates available. Tables are listed below.
          </div>
        ) : (
          <div className="relative h-full w-full" style={{ padding: `${TABLE_SIZE_PX / 2}px` }}>
            {positioned.map((entry) => {
              const variant = getVariant(entry);
              const countdown = entry.holdOwned
                ? formatCountdown(entry.holdOwned.countdownSeconds)
                : entry.holdOther
                ? formatCountdown(entry.holdOther.countdownSeconds)
                : null;
              const isBlocked =
                disabled || entry.isInactive || Boolean(entry.holdOther) || entry.conflicts.length > 0;

              return (
                <button
                  key={entry.table.id}
                  type="button"
                  className={cn(
                    'absolute flex h-16 w-16 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    getVariantClasses(variant),
                    isBlocked && variant === 'default' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  )}
                  style={{
                    left: `${entry.xPercent}%`,
                    top: `${entry.yPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${entry.rotation}deg)`,
                  }}
                  onClick={() => {
                    if (disabled || entry.isInactive) {
                      return;
                    }
                    if (entry.holdOther || entry.conflicts.length > 0) {
                      return;
                    }
                    onToggle(entry.table.id);
                  }}
                  title={formatTableTitle(entry)}
                >
                  <span className="text-sm font-semibold">{entry.table.tableNumber}</span>
                  <span className="text-[11px] font-medium">{entry.table.capacity} seats</span>
                  {countdown ? <span className="mt-0.5 text-[10px] font-semibold">{countdown}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {unpositioned.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {unpositioned.map((table) => {
            const isSelected = selectionSet.has(table.id);
            const tableHolds = holds.filter((hold) => hold.tableIds.includes(table.id));
            const holdOther = tableHolds.find((hold) => hold.bookingId && hold.bookingId !== bookingId);
            const isBlocked = disabled || !table.active || (table.status && table.status !== 'available') || Boolean(holdOther);

            return (
              <button
                key={table.id}
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                  isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border',
                  isBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
                onClick={() => {
                  if (isBlocked) {
                    return;
                  }
                  onToggle(table.id);
                }}
                title={`Table ${table.tableNumber} · ${table.capacity} seats`}
              >
                <span>{table.tableNumber}</span>
                <span className="text-[11px] font-medium">{table.capacity}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

export type { TableFloorPlanProps };
