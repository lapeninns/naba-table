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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50">
            <Sparkles className="h-4 w-4 text-indigo-700" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-foreground">Suggested tables</span>
        </div>
        <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-100">
          Suggested
        </Badge>
      </div>

      <TableCardGrid
        className="grid-cols-2 gap-3 sm:grid-cols-3"
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

