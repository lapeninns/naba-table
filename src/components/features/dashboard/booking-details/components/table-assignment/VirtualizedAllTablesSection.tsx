'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
  AllTablesEmptyState,
  AllTablesInventoryHeader,
  AllTablesInventoryShell,
} from './AllTablesInventoryChrome';
import { VirtualizedTableRows, VIRTUALIZED_TABLE_GRID_CLASS } from './VirtualizedTableRows';
import {
  buildVirtualizedTableRows,
  buildVisibleTableIndexSet,
  findFirstVisibleFocusableIndex,
  resolveActiveFocusableIndex,
  resolveTableFocusability,
} from '../../tableAssignmentVirtualizationDomain';

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

const ROW_ESTIMATE = 160;
const HEADER_ESTIMATE = 34;

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
    return buildVirtualizedTableRows({
      columns,
      conflictedTableIds,
      groupedTables,
    });
  }, [columns, conflictedTableIds, groupedTables]);

  const focusableByIndex = useMemo(() => {
    return resolveTableFocusability({
      assignedTableIds,
      conflictedTableIds,
      disabled,
      tables: flatTables,
    });
  }, [assignedTableIds, conflictedTableIds, disabled, flatTables]);

  useEffect(() => {
    if (flatTables.length === 0) return;
    const nextActive = resolveActiveFocusableIndex({ activeIndex, focusableByIndex });
    if (nextActive !== activeIndex) setActiveIndex(nextActive);
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
  const virtualRowIndexes = useMemo(() => virtualRows.map((row) => row.index), [virtualRows]);

  const visibleIndexSet = useMemo(() => {
    return buildVisibleTableIndexSet({ rowIndexes: virtualRowIndexes, rows });
  }, [rows, virtualRowIndexes]);

  const firstVisibleFocusable = useMemo(() => {
    return findFirstVisibleFocusableIndex({
      focusableByIndex,
      rowIndexes: virtualRowIndexes,
      rows,
    });
  }, [focusableByIndex, rows, virtualRowIndexes]);

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
      <AllTablesInventoryShell>
        <AllTablesInventoryHeader totalCount={0} />
        <AllTablesEmptyState />
      </AllTablesInventoryShell>
    );
  }

  return (
    <AllTablesInventoryShell>
      <AllTablesInventoryHeader totalCount={totalCount} />

      <ScrollArea className="h-[320px] pr-2 sm:h-[360px]" viewportRef={viewportRef}>
        <div
          ref={columnProbeRef}
          className={cn(VIRTUALIZED_TABLE_GRID_CLASS, 'invisible h-0 w-full')}
          aria-hidden
        />
        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          <VirtualizedTableRows
            rows={rows}
            virtualRows={virtualRows}
            activeIndex={activeIndex}
            assignedTableIds={assignedTableIds}
            bookingEndTime={bookingEndTime}
            bookingStartTime={bookingStartTime}
            buttonRefs={buttonRefs}
            columns={columns}
            conflictedTableIds={conflictedTableIds}
            disabled={disabled}
            firstVisibleFocusable={firstVisibleFocusable}
            flatTables={flatTables}
            focusableByIndex={focusableByIndex}
            measureElement={rowVirtualizer.measureElement}
            onActiveIndexChange={setActiveIndex}
            onFocusIndex={focusIndex}
            onToggle={onToggle}
            parsedBookingEnd={parsedBookingEnd}
            parsedBookingStart={parsedBookingStart}
            parsedServiceEnd={parsedServiceEnd}
            parsedServiceStart={parsedServiceStart}
            partySize={partySize}
            selectedTableIds={selectedTableIds}
            serviceWindowEnd={serviceWindowEnd}
            serviceWindowStart={serviceWindowStart}
            visibleIndexSet={visibleIndexSet}
          />
        </div>
      </ScrollArea>
    </AllTablesInventoryShell>
  );
}

export default VirtualizedAllTablesSection;
