'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import {
  BookingAssignmentAssignedTablesPanel,
  BookingAssignmentFloorPlanPanel,
  BookingAssignmentUnassignDialog,
} from './components';
import { useBookingAssignmentController } from './useBookingAssignmentController';

import type { OpsTodayBooking } from '@/types/ops';

type BookingAssignmentTabContentProps = {
  booking: OpsTodayBooking;
  restaurantId: string;
  date: string;
  onUnassignTable?: (tableId: string) => Promise<unknown>;
  onAssignmentComplete?: () => void;
};

export function BookingAssignmentTabContent({
  booking,
  restaurantId,
  date,
  onUnassignTable,
  onAssignmentComplete,
}: BookingAssignmentTabContentProps) {
  const assignment = useBookingAssignmentController({
    booking,
    date,
    onAssignmentComplete,
    onUnassignTable,
    restaurantId,
  });

  if (assignment.assignmentContextError) {
    const message =
      assignment.assignmentContextError instanceof Error
        ? assignment.assignmentContextError.message
        : 'Unknown error';

    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-destructive/5 p-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          <span className="font-medium">Error loading floor plan</span>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button
          onClick={() => assignment.refetchAssignmentContext()}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-12">
      {assignment.errorBanner ? (
        <Alert variant="destructive" className="lg:col-span-12">
          <AlertDescription className="whitespace-pre-line text-sm">
            {assignment.errorBanner}
          </AlertDescription>
        </Alert>
      ) : null}
      <BookingAssignmentFloorPlanPanel
        bookingId={booking.id}
        partySize={booking.partySize}
        selectedCount={assignment.effectiveSelectedIds.length}
        selectedCapacity={assignment.selectedCapacity}
        zoneId={assignment.validationResult?.summary?.zoneId}
        validationChecks={assignment.validationChecks}
        isLoading={assignment.assignmentContextLoading}
        isPending={assignment.isPending}
        isAssigning={assignment.directAssignPending}
        canAssign={assignment.canAssign}
        assignDisabledReason={
          assignment.selectedTables.length === 0 ? 'Select tables to assign' : null
        }
        onlyAvailable={assignment.onlyAvailable}
        tables={assignment.assignmentContext?.tables ?? []}
        holds={assignment.assignmentContext?.holds ?? []}
        conflicts={assignment.assignmentContext?.conflicts ?? []}
        bookingAssignments={assignment.assignmentContext?.bookingAssignments ?? []}
        selectedTableIds={assignment.selectedTables}
        onAssign={assignment.handleAssign}
        onClear={assignment.handleClear}
        onOnlyAvailableChange={assignment.setOnlyAvailable}
        onToggleTable={assignment.handleToggleTable}
        onRefresh={() => void assignment.refetchAssignmentContext()}
      />

      <div className="flex flex-col gap-4 lg:col-span-5">
        <BookingAssignmentAssignedTablesPanel
          assignedTables={assignment.assignedTables}
          canUnassignSingleTable={Boolean(onUnassignTable)}
          onRequestUnassignTable={assignment.setUnassignTableId}
          onRemoveAllTables={assignment.handleRemoveAllTables}
        />
      </div>

      <BookingAssignmentUnassignDialog
        open={Boolean(assignment.unassignTableId)}
        onOpenChange={assignment.handleUnassignDialogOpenChange}
        onConfirm={assignment.handleUnassignConfirm}
      />
    </div>
  );
}
