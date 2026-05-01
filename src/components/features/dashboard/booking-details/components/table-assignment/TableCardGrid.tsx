'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { SelectableTableCard } from '../SelectableTableCard';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export type TableCardGridProps = {
  className?: string;
  tables: ManualAssignmentTable[];
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

function resolveColumnCount(el: HTMLElement | null): number {
  if (!el) return 1;
  const gridColumns = window.getComputedStyle(el).gridTemplateColumns;
  if (!gridColumns || gridColumns === 'none') return 1;
  const count = gridColumns.split(' ').filter(Boolean).length;
  return Math.max(1, count);
}

export function TableCardGrid({
  className,
  tables,
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
}: TableCardGridProps) {
  const baseId = useId();
  const gridRef = useRef<HTMLUListElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [columns, setColumns] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);

  const focusableByIndex = useMemo(() => {
    return tables.map((table) => {
      const isConflicted = conflictedTableIds.has(table.id) || table.status === 'conflicted';
      const isUnavailable = isConflicted || !table.active || table.status !== 'available';
      const isAssigned = assignedTableIds.has(table.id);
      return !(disabled || isUnavailable || isAssigned);
    });
  }, [assignedTableIds, conflictedTableIds, disabled, tables]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => setColumns(resolveColumnCount(el));
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Ensure the active index is always focusable; fall back to first focusable card.
    if (tables.length === 0) return;
    if (focusableByIndex[activeIndex]) return;
    const first = focusableByIndex.findIndex(Boolean);
    setActiveIndex(first === -1 ? 0 : first);
  }, [activeIndex, focusableByIndex, tables.length]);

  const moveFocus = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= tables.length) return;
    setActiveIndex(nextIndex);
    buttonRefs.current[nextIndex]?.focus();
  };

  const findNextFocusable = (start: number, step: number) => {
    let idx = start + step;
    while (idx >= 0 && idx < tables.length) {
      if (focusableByIndex[idx]) return idx;
      idx += step;
    }
    return start;
  };

  return (
    <ul ref={gridRef} className={cn('grid gap-2', className)}>
      {tables.map((table, index) => {
        const isConflicted = conflictedTableIds.has(table.id) || table.status === 'conflicted';
        const describedById = `${baseId}-${table.id}`;

        return (
          <li key={table.id} className="min-w-0">
            <SelectableTableCard
              tableId={table.id}
              table={table}
              partySize={partySize}
              isSelected={selectedTableIds.has(table.id)}
              isAssigned={assignedTableIds.has(table.id)}
              isConflicted={isConflicted}
              onToggle={onToggle}
              disabled={disabled}
              tabIndex={index === activeIndex ? 0 : -1}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                const key = event.key.toLowerCase();

                if (key === 'arrowleft') {
                  event.preventDefault();
                  event.stopPropagation();
                  moveFocus(findNextFocusable(index, -1));
                  return;
                }
                if (key === 'arrowright') {
                  event.preventDefault();
                  event.stopPropagation();
                  moveFocus(findNextFocusable(index, 1));
                  return;
                }
                if (key === 'arrowup') {
                  event.preventDefault();
                  event.stopPropagation();
                  moveFocus(findNextFocusable(index, -columns));
                  return;
                }
                if (key === 'arrowdown') {
                  event.preventDefault();
                  event.stopPropagation();
                  moveFocus(findNextFocusable(index, columns));
                  return;
                }
                if (key === 'home') {
                  event.preventDefault();
                  event.stopPropagation();
                  const first = focusableByIndex.findIndex(Boolean);
                  moveFocus(first === -1 ? 0 : first);
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
                  moveFocus(last === -1 ? Math.max(0, tables.length - 1) : last);
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
          </li>
        );
      })}
    </ul>
  );
}

export default TableCardGrid;
