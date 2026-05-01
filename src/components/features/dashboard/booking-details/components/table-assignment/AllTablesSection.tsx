'use client';

import { Clock, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">All tables</span>
        </div>
        <span className="text-xs text-muted-foreground">{totalCount} tables</span>
      </div>

      {totalCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm text-muted-foreground">
            No tables match the current filters. Try widening the fit or availability filters.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[320px] pr-2">
          <div className="space-y-4">
            {Array.from(groupedTables.entries()).map(([section, sectionTables]) => {
              const conflictedInZone = sectionTables.filter((t) => conflictedTableIds.has(t.id));
              return (
                <div key={section} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        {section}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({sectionTables.length})
                      </span>
                    </div>
                    {conflictedInZone.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-primary/30 bg-primary/10 text-primary"
                      >
                        <Clock className="h-3 w-3" aria-hidden />
                        {conflictedInZone.length} conflict{conflictedInZone.length > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>

                  <TableCardGrid
                    className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
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
    </section>
  );
}

export default AllTablesSection;
