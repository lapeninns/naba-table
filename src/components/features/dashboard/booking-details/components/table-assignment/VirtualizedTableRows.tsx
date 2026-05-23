'use client';

import {
  resolveVirtualizedTableKeyboardAction,
  resolveVirtualizedTableTabIndex,
  type VirtualizedTableRow,
} from '../../tableAssignmentVirtualizationDomain';
import { SelectableTableCard } from '../SelectableTableCard';
import { AllTablesConflictBadge } from './AllTablesInventoryChrome';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

const GRID_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3';

export type VirtualizedTableRowsProps = {
  rows: VirtualizedTableRow[];
  virtualRows: Array<{
    index: number;
    key: React.Key;
    start: number;
  }>;
  activeIndex: number;
  assignedTableIds: Set<string>;
  bookingEndTime?: string | null;
  bookingStartTime?: string | null;
  buttonRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  columns: number;
  conflictedTableIds: Set<string>;
  disabled: boolean;
  firstVisibleFocusable: number;
  flatTables: ManualAssignmentTable[];
  focusableByIndex: boolean[];
  measureElement: (node: Element | null) => void;
  onActiveIndexChange: (index: number) => void;
  onFocusIndex: (index: number) => void;
  onToggle: (tableId: string) => void;
  parsedBookingEnd?: number | null;
  parsedBookingStart?: number | null;
  parsedServiceEnd?: number | null;
  parsedServiceStart?: number | null;
  partySize: number;
  selectedTableIds: Set<string>;
  serviceWindowEnd?: string | null;
  serviceWindowStart?: string | null;
  visibleIndexSet: Set<number>;
};

export function VirtualizedTableRows({
  rows,
  virtualRows,
  activeIndex,
  assignedTableIds,
  bookingEndTime,
  bookingStartTime,
  buttonRefs,
  columns,
  conflictedTableIds,
  disabled,
  firstVisibleFocusable,
  flatTables,
  focusableByIndex,
  measureElement,
  onActiveIndexChange,
  onFocusIndex,
  onToggle,
  parsedBookingEnd,
  parsedBookingStart,
  parsedServiceEnd,
  parsedServiceStart,
  partySize,
  selectedTableIds,
  serviceWindowEnd,
  serviceWindowStart,
  visibleIndexSet,
}: VirtualizedTableRowsProps) {
  return (
    <>
      {virtualRows.map((row) => {
        const item = rows[row.index];
        if (!item) return null;

        return (
          <div
            key={row.key}
            ref={measureElement}
            data-index={row.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {item.kind === 'header' ? (
              <VirtualizedTableSectionHeader item={item} />
            ) : (
              <div className={GRID_CLASS}>
                {item.tables.map((table, offset) => {
                  const index = item.startIndex + offset;
                  const isConflicted =
                    conflictedTableIds.has(table.id) || table.status === 'conflicted';
                  const describedById = `virtual-table-${table.id}`;
                  const tabIndex = resolveVirtualizedTableTabIndex({
                    activeIndex,
                    firstVisibleFocusable,
                    index,
                    visibleIndexSet,
                  });

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
                      onFocus={() => onActiveIndexChange(index)}
                      onKeyDown={(event) => {
                        const action = resolveVirtualizedTableKeyboardAction({
                          columns,
                          focusableByIndex,
                          index,
                          key: event.key,
                          tableCount: flatTables.length,
                        });

                        if (action.kind === 'none') return;
                        event.preventDefault();
                        event.stopPropagation();

                        if (action.kind === 'focus') {
                          onFocusIndex(action.index);
                          return;
                        }

                        onToggle(table.id);
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
    </>
  );
}

function VirtualizedTableSectionHeader({
  item,
}: {
  item: Extract<VirtualizedTableRow, { kind: 'header' }>;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {item.section}
        </span>
        <span className="text-xs text-muted-foreground">({item.tableCount})</span>
      </div>
      <AllTablesConflictBadge count={item.conflictCount} />
    </div>
  );
}

export { GRID_CLASS as VIRTUALIZED_TABLE_GRID_CLASS };
