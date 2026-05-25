'use client';

import { LayoutGrid, RefreshCw } from 'lucide-react';

import { AssignmentToolbar } from '@/components/features/dashboard/manual-assignment/AssignmentToolbar';
import { ValidationChecks } from '@/components/features/dashboard/manual-assignment/ValidationChecks';
import { TableFloorPlan } from '@/components/features/dashboard/TableFloorPlan';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type {
  ManualAssignmentConflict,
  ManualAssignmentContextHold,
  ManualAssignmentTable,
  ManualSelectionCheck,
} from '@/services/ops/bookings';

export type BookingAssignmentFloorPlanPanelProps = {
  bookingId: string;
  partySize: number;
  selectedCount: number;
  selectedCapacity: number;
  zoneId: string | null | undefined;
  validationChecks: ManualSelectionCheck[];
  isLoading: boolean;
  isPending: boolean;
  isAssigning: boolean;
  canAssign: boolean;
  assignDisabledReason: string | null;
  onlyAvailable: boolean;
  tables: ManualAssignmentTable[];
  holds: ManualAssignmentContextHold[];
  conflicts: ManualAssignmentConflict[];
  bookingAssignments: string[];
  selectedTableIds: string[];
  onAssign: () => void;
  onClear: () => void;
  onOnlyAvailableChange: (value: boolean) => void;
  onToggleTable: (tableId: string) => void;
  onRefresh: () => void;
};

export function BookingAssignmentFloorPlanPanel({
  bookingId,
  partySize,
  selectedCount,
  selectedCapacity,
  zoneId,
  validationChecks,
  isLoading,
  isPending,
  isAssigning,
  canAssign,
  assignDisabledReason,
  onlyAvailable,
  tables,
  holds,
  conflicts,
  bookingAssignments,
  selectedTableIds,
  onAssign,
  onClear,
  onOnlyAvailableChange,
  onToggleTable,
  onRefresh,
}: BookingAssignmentFloorPlanPanelProps) {
  return (
    <div className="flex flex-col gap-4 lg:col-span-7">
      <AssignmentToolbar
        selectedCount={selectedCount}
        selectedCapacity={selectedCapacity}
        partySize={partySize}
        zoneId={zoneId}
        validationChecks={validationChecks}
        onAssign={onAssign}
        onClear={onClear}
        isPending={isPending}
        isAssigning={isAssigning}
        canAssign={canAssign}
        assignDisabledReason={assignDisabledReason}
        onlyAvailable={onlyAvailable}
        onOnlyAvailableChange={onOnlyAvailableChange}
      />

      {validationChecks.length > 0 ? <ValidationChecks checks={validationChecks} /> : null}

      <div
        className="relative flex-1 overflow-hidden rounded-xl border bg-muted/10 min-h-[400px]"
        role="region"
        aria-label="Table floor plan"
      >
        {isLoading ? (
          <div className="p-6" role="status" aria-live="polite">
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {Array.from({ length: 18 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-xl" />
              ))}
            </div>
            <span className="sr-only">Loading floor plan...</span>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
            <div className="flex size-20 items-center justify-center rounded-full border-2 border-muted bg-muted/40">
              <LayoutGrid className="size-10 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="flex max-w-md flex-col gap-2 text-center">
              <h3 className="text-xl font-semibold text-foreground">No tables available</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                There are no tables configured for this restaurant. Contact your administrator to
                set up table inventory.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-auto p-2 sm:p-4">
            <TableFloorPlan
              bookingId={bookingId}
              tables={tables}
              holds={holds}
              conflicts={conflicts}
              bookingAssignments={bookingAssignments}
              selectedTableIds={selectedTableIds}
              onToggle={onToggleTable}
              disabled={isPending}
              onlyAvailable={onlyAvailable}
              className="min-w-[320px] sm:min-w-[500px] md:min-w-[600px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingAssignmentFloorPlanPanel;
