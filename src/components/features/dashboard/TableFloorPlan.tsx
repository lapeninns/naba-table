'use client';

import { memo, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  deriveTableFloorPlanLayout,
  deriveUnpositionedTableState,
  formatFloorPlanCountdown,
  formatFloorPlanTableAriaLabel,
  formatFloorPlanTableTitle,
  formatUnpositionedTableAriaLabel,
  getFloorPlanTableVariant,
  type FloorPlanTableVariant,
} from './tableFloorPlanDomain';

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
  /** When true, hide tables that are unavailable for the current window (conflicts/holds/inactive). */
  onlyAvailable?: boolean;
  className?: string;
};

const TABLE_SIZE_PX = 64;

function getVariantClasses(variant: FloorPlanTableVariant): string {
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
  onlyAvailable = false,
  className,
}: TableFloorPlanProps) {
  const selectedTableIdSet = useMemo(() => new Set(selectedTableIds), [selectedTableIds]);
  const conflictTableIds = useMemo(() => new Set(conflicts.map((c) => c.tableId)), [conflicts]);

  const { groupedUnpositioned, positioned } = useMemo(
    () =>
      deriveTableFloorPlanLayout({
        bookingAssignments,
        bookingId,
        conflicts,
        holds,
        onlyAvailable,
        selectedTableIds,
        tables,
      }),
    [bookingAssignments, bookingId, conflicts, holds, onlyAvailable, selectedTableIds, tables],
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Tables</div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
            Selected
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
            Assigned
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
            Held/Blocked
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
            Inactive
          </span>
        </div>
      </div>

      {positioned.length > 0 && (
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-border bg-muted/20"
          style={{ minHeight: 320 }}
          role="region"
          aria-label="Table floor plan"
        >
          <div className="relative h-full w-full" style={{ padding: `${TABLE_SIZE_PX / 2}px` }}>
            {positioned.map((entry) => {
              const variant = getFloorPlanTableVariant(entry);
              const countdown = entry.holdOwned
                ? formatFloorPlanCountdown(entry.holdOwned.countdownSeconds)
                : entry.holdOther
                  ? formatFloorPlanCountdown(entry.holdOther.countdownSeconds)
                  : null;
              const isBlocked =
                disabled ||
                entry.isInactive ||
                Boolean(entry.holdOther) ||
                entry.conflicts.length > 0;

              return (
                <Button
                  key={entry.table.id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'absolute flex h-16 w-16 flex-col items-center justify-center rounded-xl border p-0 text-xs font-semibold transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    getVariantClasses(variant),
                    isBlocked && variant === 'default'
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer',
                  )}
                  style={{
                    left: `${entry.xPercent}%`,
                    top: `${entry.yPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${entry.rotation}deg)`,
                  }}
                  onClick={() => {
                    if (disabled || entry.isInactive) return;
                    if (entry.holdOther || entry.conflicts.length > 0) return;
                    onToggle(entry.table.id);
                  }}
                  title={formatFloorPlanTableTitle(entry)}
                  aria-label={formatFloorPlanTableAriaLabel({
                    entry,
                    isBlocked,
                    isSelected: variant === 'selected',
                  })}
                  aria-pressed={variant === 'selected' ? true : undefined}
                  disabled={isBlocked}
                  aria-disabled={isBlocked || undefined}
                >
                  <span className="text-sm font-semibold">{entry.table.tableNumber}</span>
                  <span className="text-[11px] font-medium">{entry.table.capacity} seats</span>
                  {countdown ? (
                    <span className="mt-0.5 text-[10px] font-semibold">{countdown}</span>
                  ) : null}
                  {!countdown &&
                  (entry.holdOther || !entry.table.active || entry.conflicts.length > 0) ? (
                    <span className="mt-0.5 text-[10px] font-semibold">
                      {entry.holdOther
                        ? 'Held'
                        : entry.conflicts.length > 0
                          ? 'Conflict'
                          : 'Inactive'}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3" aria-label="Table list">
        {groupedUnpositioned.map((group) => {
          const zoneLabel = group.zoneId ? `Zone ${group.zoneId.slice(0, 8)}` : 'Zone not set';
          const sectionLabel = group.section ? `Section ${group.section}` : 'Section not set';
          return (
            <div
              key={`${group.zoneId ?? 'unknown'}::${group.section ?? 'unassigned'}`}
              className="space-y-2 rounded-xl border border-border/60 bg-background px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{sectionLabel}</span>
                <span aria-hidden>•</span>
                <span>{zoneLabel}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {group.tables.map((table) => {
                  const { hasConflict, holdOther, isBlocked, isInactive, isSelected } =
                    deriveUnpositionedTableState({
                      bookingId,
                      conflictTableIds,
                      disabled,
                      holds,
                      selectedTableIdSet,
                      table,
                    });

                  return (
                    <Button
                      key={table.id}
                      type="button"
                      variant="ghost"
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-xl border-2 px-3 py-2.5 text-left transition-[transform,box-shadow,border-color,background-color,color] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        isSelected
                          ? 'bg-primary/10 text-primary border-primary shadow-sm'
                          : 'bg-background text-foreground border-border hover:border-primary/30',
                        isBlocked
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer hover:-translate-y-0.5',
                      )}
                      onClick={() => {
                        if (isBlocked) return;
                        onToggle(table.id);
                      }}
                      title={
                        table.name
                          ? `Table ${table.tableNumber} - ${table.name} · ${table.capacity} seats`
                          : `Table ${table.tableNumber} · ${table.capacity} seats`
                      }
                      aria-label={formatUnpositionedTableAriaLabel({
                        hasConflict,
                        holdOther,
                        isBlocked,
                        isInactive,
                        isSelected,
                        table,
                      })}
                      aria-pressed={isSelected ? true : undefined}
                      disabled={isBlocked}
                      aria-disabled={isBlocked || undefined}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Table
                        </span>
                        <span className="text-lg font-bold tabular-nums">{table.tableNumber}</span>
                      </div>
                      {table.name && (
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                          <span>{table.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="font-medium">{table.capacity} seats</span>
                      </div>
                      {(holdOther || hasConflict || isInactive) && (
                        <div className="mt-1 flex items-center gap-1">
                          {holdOther ? (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                              Held
                            </span>
                          ) : hasConflict ? (
                            <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-900">
                              Conflict
                            </span>
                          ) : isInactive ? (
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                              Inactive
                            </span>
                          ) : null}
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export type { TableFloorPlanProps };
