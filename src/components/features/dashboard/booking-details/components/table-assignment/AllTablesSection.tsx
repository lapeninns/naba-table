'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/typography';

import {
  AllTablesConflictBadge,
  AllTablesEmptyState,
  AllTablesInventoryHeader,
  AllTablesInventoryShell,
} from './AllTablesInventoryChrome';
import { TableCardGrid } from './TableCardGrid';
import { VirtualizedAllTablesSection } from './VirtualizedAllTablesSection';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export type AllTablesSectionProps = {
  groupedTables: Map<string, ManualAssignmentTable[]>;
  filteredTables: ManualAssignmentTable[];
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

const VIRTUALIZE_MIN_TABLES = 30;

export function AllTablesSection({
  groupedTables,
  filteredTables,
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
}: AllTablesSectionProps) {
  if (filteredTables.length >= VIRTUALIZE_MIN_TABLES) {
    return (
      <VirtualizedAllTablesSection
        groupedTables={groupedTables}
        totalCount={totalCount}
        partySize={partySize}
        selectedTableIds={selectedTableIds}
        assignedTableIds={assignedTableIds}
        conflictedTableIds={conflictedTableIds}
        disabled={disabled}
        onToggle={onToggle}
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
  }

  return (
    <AllTablesInventoryShell>
      <AllTablesInventoryHeader className="flex-wrap gap-2" totalCount={totalCount} />

      {totalCount === 0 ? (
        <AllTablesEmptyState />
      ) : (
        <ScrollArea className="h-[480px] pr-2 sm:h-[520px]">
          <div className="space-y-4">
            {Array.from(groupedTables.entries()).map(([section, sectionTables]) => {
              const conflictedInZone = sectionTables.filter((t) => conflictedTableIds.has(t.id));
              return (
                <div key={section} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Text variant="eyebrow" as="span" className="text-foreground">
                        {section}
                      </Text>
                      <span className="text-xs text-muted-foreground">
                        ({sectionTables.length})
                      </span>
                    </div>
                    <AllTablesConflictBadge count={conflictedInZone.length} />
                  </div>

                  <TableCardGrid
                    className="grid-cols-1 sm:grid-cols-2"
                    tables={sectionTables}
                    partySize={partySize}
                    selectedTableIds={selectedTableIds}
                    assignedTableIds={assignedTableIds}
                    conflictedTableIds={conflictedTableIds}
                    disabled={disabled}
                    onToggle={onToggle}
                    bookingStartTime={bookingStartTime}
                    bookingEndTime={bookingEndTime}
                    serviceWindowStart={serviceWindowStart}
                    serviceWindowEnd={serviceWindowEnd}
                    parsedBookingStart={parsedBookingStart}
                    parsedBookingEnd={parsedBookingEnd}
                    parsedServiceStart={parsedServiceStart}
                    parsedServiceEnd={parsedServiceEnd}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </AllTablesInventoryShell>
  );
}

export default AllTablesSection;
