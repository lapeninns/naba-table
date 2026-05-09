'use client';

import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { TableCardGrid } from './TableCardGrid';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export type SuggestedTablesSectionProps = {
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

export function SuggestedTablesSection({
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
}: SuggestedTablesSectionProps) {
  if (tables.length === 0) return null;

  return (
    <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
            <Sparkles className="size-4 text-primary" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-foreground">Best Matches</span>
        </div>
        <Badge
          variant="secondary"
          className="border border-primary/20 bg-primary/10 text-[10px] text-primary"
        >
          Recommended
        </Badge>
      </div>

      <TableCardGrid
        className="grid-cols-1 gap-2 sm:grid-cols-2"
        tables={tables.slice(0, 6)}
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
    </section>
  );
}

export default SuggestedTablesSection;
