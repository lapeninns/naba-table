'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Clock, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { SelectableTableCard } from '../SelectableTableCard';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export type VirtualizedAllTablesSectionProps = {
  groupedTables: Map<string, ManualAssignmentTable[]>;
  totalCount: number;
  partySize: number;
  selectedTableIds: Set<string>;
  assignedTableIds: Set<string>;
  conflictedTableIds: Set<string>;
  disabled: boolean;
  onToggle: (tableId: string) => void;
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
  serviceWindowStart?: string | null;
  serviceWindowEnd?: string | null;
  parsedBookingStart?: number | null;
  parsedBookingEnd?: number | null;
  parsedServiceStart?: number | null;
  parsedServiceEnd?: number | null;
};

type Row =
  | { kind: 'header'; section: string; conflictCount: number; tableCount: number }
  | { kind: 'tables'; tables: ManualAssignmentTable[]; startIndex: number };

const ROW_ESTIMATE = 140;
const HEADER_ESTIMATE = 34;
const GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2';

function resolveColumnCount(el: HTMLElement | null): number {
  if (!el) return 1;
  const gridColumns = window.getComputedStyle(el).gridTemplateColumns;
  if (!gridColumns || gridColumns === 'none') return 1;
  const count = gridColumns.split(' ').filter(Boolean).length;
  return Math.max(1, count);
}

export function VirtualizedAllTablesSection({
  groupedTables,
  totalCount,
  partySize,
  selectedTableIds,
  assignedTableIds,
  conflictedTableIds,
  disabled,
  onToggle,
  bookingStartTime,
  bookingEndTime,
  serviceWindowStart,
  serviceWindowEnd,
  parsedBookingStart,
  parsedBookingEnd,
  parsedServiceStart,
  parsedServiceEnd,
}: VirtualizedAllTablesSectionProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const columnProbeRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(2);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const probe = columnProbeRef.current;
    if (!probe) return;

    const measure = () => setColumns(resolveColumnCount(probe));
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(probe);
    return () => ro.disconnect();
  }, []);

  const { rows, tableIndexToRowIndex, flatTables } = useMemo(() => {
    const nextRows: Row[] = [];
    const map = new Map<number, number>();
    const flat: ManualAssignmentTable[] = [];
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

      for (let i = 0; i < sectionTables.length; i += columns) {
        const slice = sectionTables.slice(i, i + columns);
        const startIndex = flat.length;
        flat.push(...slice);
        nextRows.push({ kind: 'tables', tables: slice, startIndex });
        slice.forEach((_, offset) => map.set(startIndex + offset, rowIndex));
        rowIndex += 1;
      }
    });

    return { rows: nextRows, tableIndexToRowIndex: map, flatTables: flat };
  }, [columns, conflictedTableIds, groupedTables]);

  const focusableByIndex = useMemo(() => {
    return flatTables.map((table) => {
      const isConflicted = conflictedTableIds.has(table.id) || table.status === 'conflicted';
      const isUnavailable = isConflicted || !table.active || table.status !== 'available';
      const isAssigned = assignedTableIds.has(table.id);
      return !(disabled || isUnavailable || isAssigned);
    });
  }, [assignedTableIds, conflictedTableIds, disabled, flatTables]);

  useEffect(() => {
    if (flatTables.length === 0) return;
    if (focusableByIndex[activeIndex]) return;
    const first = focusableByIndex.findIndex(Boolean);
    setActiveIndex(first === -1 ? 0 : first);
  }, [activeIndex, flatTables.length, focusableByIndex]);

  // TanStack Virtual returns functions that are not compatible with React Compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => (rows[index]?.kind === 'header' ? HEADER_ESTIMATE : ROW_ESTIMATE),
    overscan: 4,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const visibleIndexSet = useMemo(() => {
    const set = new Set<number>();
    virtualRows.forEach((row) => {
      const item = rows[row.index];
      if (item?.kind !== 'tables') return;
      item.tables.forEach((_, offset) => {
        set.add(item.startIndex + offset);
      });
    });
    return set;
  }, [rows, virtualRows]);

  const firstVisibleFocusable = useMemo(() => {
    for (const row of virtualRows) {
      const item = rows[row.index];
      if (!item || item.kind !== 'tables') continue;
      for (let offset = 0; offset < item.tables.length; offset += 1) {
        const idx = item.startIndex + offset;
        if (focusableByIndex[idx]) return idx;
      }
    }
    return -1;
  }, [focusableByIndex, rows, virtualRows]);

  const focusIndex = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= flatTables.length) return;
    setActiveIndex(nextIndex);
    const immediateTarget = buttonRefs.current[nextIndex];
    if (immediateTarget) {
      immediateTarget.focus();
      pendingFocusIndexRef.current = null;
      return;
    }
    pendingFocusIndexRef.current = nextIndex;
    const rowIndex = tableIndexToRowIndex.get(nextIndex);
    if (rowIndex !== undefined) {
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
  };

  const findNextFocusable = (start: number, step: number) => {
    let idx = start + step;
    while (idx >= 0 && idx < flatTables.length) {
      if (focusableByIndex[idx]) return idx;
      idx += step;
    }
    return start;
  };

  useEffect(() => {
    if (pendingFocusIndexRef.current === null) return;
    const idx = pendingFocusIndexRef.current;
    const target = buttonRefs.current[idx];
    if (target) {
      pendingFocusIndexRef.current = null;
      target.focus();
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const next = buttonRefs.current[idx];
      if (next) {
        pendingFocusIndexRef.current = null;
        next.focus();
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [virtualRows]);

  if (totalCount === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">All tables</span>
          </div>
          <span className="text-xs text-muted-foreground">0 tables</span>
        </div>
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm text-muted-foreground">
            No tables match the current filters. Try widening the fit or availability filters.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">All tables</span>
        </div>
        <span className="text-xs text-muted-foreground">{totalCount} tables</span>
      </div>

      <ScrollArea className="h-[320px] pr-2" viewportRef={viewportRef}>
        <div ref={columnProbeRef} className={cn(GRID_CLASS, 'invisible h-0 w-full')} aria-hidden />
        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {virtualRows.map((row) => {
            const item = rows[row.index];
            if (!item) return null;

            return (
              <div
                key={row.key}
                ref={rowVirtualizer.measureElement}
                data-index={row.index}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${row.start}px)` }}
              >
                {item.kind === 'header' ? (
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        {item.section}
                      </span>
                      <span className="text-xs text-muted-foreground">({item.tableCount})</span>
                    </div>
                    {item.conflictCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-300 bg-amber-50 text-amber-800"
                      >
                        <Clock className="h-3 w-3" aria-hidden />
                        {item.conflictCount} conflict{item.conflictCount > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <div className={GRID_CLASS}>
                    {item.tables.map((table, offset) => {
                      const index = item.startIndex + offset;
                      const isConflicted =
                        conflictedTableIds.has(table.id) || table.status === 'conflicted';
                      const describedById = `virtual-table-${table.id}`;
                      const isVisibleActive = visibleIndexSet.has(activeIndex);
                      const tabIndex =
                        index === activeIndex
                          ? 0
                          : !isVisibleActive && index === firstVisibleFocusable
                            ? 0
                            : -1;

                      return (
                        <SelectableTableCard
                          key={table.id}
                          tableId={table.id}
                          table={table}
                          partySize={partySize}
                          isSelected={selectedTableIds.has(table.id)}
                          isAssigned={assignedTableIds.has(table.id)}
                          isConflicted={isConflicted}
                          onToggle={onToggle}
                          disabled={disabled}
                          tabIndex={tabIndex}
                          onFocus={() => setActiveIndex(index)}
                          onKeyDown={(event) => {
                            const key = event.key.toLowerCase();

                            if (key === 'arrowleft') {
                              event.preventDefault();
                              event.stopPropagation();
                              focusIndex(findNextFocusable(index, -1));
                              return;
                            }
                            if (key === 'arrowright') {
                              event.preventDefault();
                              event.stopPropagation();
                              focusIndex(findNextFocusable(index, 1));
                              return;
                            }
                            if (key === 'arrowup') {
                              event.preventDefault();
                              event.stopPropagation();
                              focusIndex(findNextFocusable(index, -columns));
                              return;
                            }
                            if (key === 'arrowdown') {
                              event.preventDefault();
                              event.stopPropagation();
                              focusIndex(findNextFocusable(index, columns));
                              return;
                            }
                            if (key === 'home') {
                              event.preventDefault();
                              event.stopPropagation();
                              const first = focusableByIndex.findIndex(Boolean);
                              focusIndex(first === -1 ? 0 : first);
                              return;
                            }
                            if (key === 'end') {
                              event.preventDefault();
                              event.stopPropagation();
                              const last = (() => {
                                for (let i = focusableByIndex.length - 1; i >= 0; i -= 1) {
                                  if (focusableByIndex[i]) return i;
                                }
                                return -1;
                              })();
                              focusIndex(last === -1 ? Math.max(0, flatTables.length - 1) : last);
                              return;
                            }
                            if (key === 'enter' || key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              onToggle(table.id);
                            }
                          }}
                          describedById={describedById}
                          buttonRef={(el) => {
                            buttonRefs.current[index] = el;
                          }}
                          bookingStartTime={bookingStartTime}
                          bookingEndTime={bookingEndTime}
                          serviceWindowStart={serviceWindowStart}
                          serviceWindowEnd={serviceWindowEnd}
                          parsedBookingStart={parsedBookingStart}
                          parsedBookingEnd={parsedBookingEnd}
                          parsedServiceStart={parsedServiceStart}
                          parsedServiceEnd={parsedServiceEnd}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}

export default VirtualizedAllTablesSection;
