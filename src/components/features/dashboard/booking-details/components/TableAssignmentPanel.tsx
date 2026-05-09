/**
 * TableAssignmentPanel
 *
 * Table selection UI with filters, warnings, and confirmation.
 */

'use client';

import { AlertTriangle, Grid3X3, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getBookingClockMinutes } from '@reserve/shared/formatting/bookingDateTime';

import { useTableAssignment } from '../hooks/useTableAssignment';
import { groupTablesBySection } from '../utils';
import { AllTablesSection } from './table-assignment/AllTablesSection';
import { SuggestedTablesSection } from './table-assignment/SuggestedTablesSection';
import { TableAssignmentAlerts } from './table-assignment/TableAssignmentAlerts';
import { TableAssignmentFilters } from './table-assignment/TableAssignmentFilters';
import { TableAssignmentSummaryCard } from './table-assignment/TableAssignmentSummaryCard';

export interface TableAssignmentPanelProps {
  bookingId: string;
  restaurantId: string;
  partySize: number;
  date: string | null;
  currentAssignments: string[];
  onAssignmentComplete: () => void;
  initialFocusRef?: React.RefObject<HTMLButtonElement | null>;
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
  enabled?: boolean;
  /**
   * Forwarded to the underlying `useTableAssignment` hook. When `false`, the
   * per-hook realtime subscription is suppressed because a parent (such as
   * `useOpsBookingDialogBundle`) is already maintaining a consolidated
   * channel for the same data.
   */
  realtime?: boolean;
}

type FitFilter = 'all' | 'perfect' | 'exact' | 'within' | 'oversized' | 'too_small';
type SortOption = 'best' | 'capacity' | 'table';

export function TableAssignmentPanel({
  bookingId,
  restaurantId,
  partySize,
  date,
  currentAssignments,
  onAssignmentComplete,
  initialFocusRef,
  bookingStartTime,
  bookingEndTime,
  enabled = true,
  realtime = true,
}: TableAssignmentPanelProps) {
  const {
    context,
    isLoading,
    error,
    refetch,
    tables,
    suggestedTables,
    selectedTables,
    setSelectedTables,
    selectedCapacity,
    assignedCapacity,
    assignedTableIds,
    conflictedTableIds,
    validation,
    apply,
    unassignAll,
    autoAssign,
    isPending,
  } = useTableAssignment({
    bookingId,
    restaurantId,
    partySize,
    date,
    currentAssignments,
    onAssignmentComplete,
    enabled,
    realtime,
  });

  const parsedTimes = useMemo(() => {
    const timelineBookingStart = bookingStartTime ?? context?.booking.start_time ?? null;
    const timelineBookingEnd = bookingEndTime ?? null;
    const timelineWindowStart = context?.window?.startAt ?? null;
    const timelineWindowEnd = context?.window?.endAt ?? null;
    const timezone = context?.timezone ?? 'UTC';

    return {
      bookingStart: timelineBookingStart,
      bookingEnd: timelineBookingEnd,
      windowStart: timelineWindowStart,
      windowEnd: timelineWindowEnd,
      parsedBookingStart: getBookingClockMinutes(timelineBookingStart, timezone),
      parsedBookingEnd: getBookingClockMinutes(timelineBookingEnd, timezone),
      parsedWindowStart: getBookingClockMinutes(timelineWindowStart, timezone),
      parsedWindowEnd: getBookingClockMinutes(timelineWindowEnd, timezone),
    };
  }, [
    bookingStartTime,
    bookingEndTime,
    context?.booking.start_time,
    context?.timezone,
    context?.window?.startAt,
    context?.window?.endAt,
  ]);

  const [zoneFilter, setZoneFilter] = useState('all');
  const [fitFilter, setFitFilter] = useState<FitFilter>('all');
  const [availabilityOnly, setAvailabilityOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('best');
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [smartAssignError, setSmartAssignError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [srStatusMessage, setSrStatusMessage] = useState<string>('');
  const selectedTableIds = useMemo(() => new Set(selectedTables), [selectedTables]);

  useEffect(() => {
    if (applyError) setApplyError(null);
    if (smartAssignError) setSmartAssignError(null);
    if (successMessage) setSuccessMessage(null);
  }, [selectedTables, assignedTableIds, applyError, smartAssignError, successMessage]);

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();
    tables.forEach((table) => zones.add(table.section || 'Main'));
    return ['all', ...Array.from(zones).sort((a, b) => a.localeCompare(b))];
  }, [tables]);

  const filteredTables = useMemo(() => {
    let list = tables;

    if (zoneFilter !== 'all') {
      list = list.filter((table) => (table.section || 'Main') === zoneFilter);
    }

    if (availabilityOnly) {
      list = list.filter(
        (table) =>
          table.active && table.status === 'available' && !conflictedTableIds.has(table.id),
      );
    }

    if (fitFilter === 'perfect') {
      list = list.filter(
        (table) => table.capacity === partySize || table.capacity === partySize + 1,
      );
    } else if (fitFilter !== 'all') {
      list = list.filter((table) => {
        const diff = table.capacity - partySize;
        if (fitFilter === 'exact') return diff === 0;
        if (fitFilter === 'within') return diff > 0 && diff <= 2;
        if (fitFilter === 'oversized') return diff > 2;
        if (fitFilter === 'too_small') return diff < 0;
        return true;
      });
    }

    const result = [...list];

    if (sortBy === 'capacity') {
      result.sort((a, b) => a.capacity - b.capacity);
    } else if (sortBy === 'table') {
      result.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
    } else {
      result.sort((a, b) => {
        const diffA = Math.abs(a.capacity - partySize);
        const diffB = Math.abs(b.capacity - partySize);
        return diffA - diffB;
      });
    }

    return result;
  }, [availabilityOnly, conflictedTableIds, fitFilter, partySize, sortBy, tables, zoneFilter]);

  const groupedTables = useMemo(() => groupTablesBySection(filteredTables), [filteredTables]);

  const handleApply = () => {
    if (validation.errors.length > 0 || selectedTables.length === 0) return;
    setConfirmApply(true);
  };

  const handleToggleTable = useCallback(
    (tableId: string) => {
      setSelectedTables((prev) =>
        prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
      );
    },
    [setSelectedTables],
  );

  const handleSmartAssign = async () => {
    if (assignedTableIds.size > 0) {
      setSmartAssignError('Remove current table assignments before using smart assign.');
      return;
    }

    setSmartAssignError(null);
    const result = await autoAssign();

    if (!result.ok) {
      setSmartAssignError(result.error ?? 'Smart assign failed.');
      setSrStatusMessage(result.error ?? 'Smart assign failed.');
      return;
    }

    setSuccessMessage('Suggested tables assigned.');
    setSrStatusMessage('Suggested tables assigned.');
  };

  const handleConfirmApply = async () => {
    setConfirmApply(false);
    const result = await apply();
    setApplyError(result.ok ? null : (result.error ?? 'Unable to apply tables.'));
    if (result.ok) {
      setSuccessMessage('Tables assigned.');
      setSrStatusMessage('Tables assigned.');
    } else {
      setSrStatusMessage(result.error ?? 'Unable to apply tables.');
    }
  };

  const handleUnassign = () => {
    setConfirmUnassign(true);
  };

  const handleConfirmUnassign = async () => {
    setConfirmUnassign(false);
    const result = await unassignAll();
    setApplyError(result.ok ? null : (result.error ?? 'Unable to unassign tables.'));
    if (result.ok) {
      setSuccessMessage('Tables unassigned.');
      setSrStatusMessage('Tables unassigned.');
    } else {
      setSrStatusMessage(result.error ?? 'Unable to unassign tables.');
    }
  };

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => setSuccessMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (!srStatusMessage) return;
    const t = window.setTimeout(() => setSrStatusMessage(''), 2500);
    return () => window.clearTimeout(t);
  }, [srStatusMessage]);

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="space-y-4 p-4">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="h-20 bg-muted/60 rounded-lg" />
            <div className="h-20 bg-muted/60 rounded-lg" />
            <div className="h-20 bg-muted/60 rounded-lg" />
          </div>
          <div className="h-10 bg-muted/60 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load tables</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error instanceof Error ? error.message : 'Failed to load tables.'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (tables.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
          <Grid3X3 className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No tables available right now.</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting the booking time or split the party.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <BookingOfflineBanner />

      <div className="sr-only" role="status" aria-live="polite">
        {srStatusMessage}
      </div>

      <div className="flex flex-col gap-5">
        {/* Zone 1: Control Rail — full-width compact strip */}
        <div className="space-y-3">
          <TableAssignmentSummaryCard
            partySize={partySize}
            selectedCapacity={selectedCapacity}
            assignedCapacity={assignedCapacity}
            selectedCount={selectedTables.length}
            assignedCount={assignedTableIds.size}
            isPending={isPending}
            isApplyBlocked={validation.errors.length > 0}
            isApplyDisabled={selectedTables.length === 0 || validation.errors.length > 0}
            applyDisabledReason={
              validation.errors.length > 0 ? 'Resolve blocking issues above to continue.' : null
            }
            onSmartAssign={() => void handleSmartAssign()}
            onClearSelected={() => setSelectedTables([])}
            onResetAssigned={handleUnassign}
            onConfirmApply={handleApply}
            initialFocusRef={initialFocusRef}
          />

          <TableAssignmentFilters
            zoneOptions={zoneOptions}
            zoneFilter={zoneFilter}
            onZoneFilterChange={setZoneFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            availabilityOnly={availabilityOnly}
            onAvailabilityOnlyChange={setAvailabilityOnly}
            fitFilter={fitFilter}
            onFitFilterChange={setFitFilter}
            onResetFilters={() => {
              setZoneFilter('all');
              setFitFilter('all');
              setAvailabilityOnly(false);
              setSortBy('best');
            }}
          />

          <TableAssignmentAlerts
            applyError={applyError}
            smartAssignError={smartAssignError}
            validation={validation}
            successMessage={successMessage}
          />
        </div>

        {/* Zone 2: Table Canvas — always full-width */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Table Inventory
            </h3>
            <span className="flex-1 h-px bg-border/30" />
          </div>
          <div className="space-y-6">
            <SuggestedTablesSection
              tables={suggestedTables}
              partySize={partySize}
              selectedTableIds={selectedTableIds}
              assignedTableIds={assignedTableIds}
              conflictedTableIds={conflictedTableIds}
              disabled={isPending}
              onToggle={handleToggleTable}
              bookingStartTime={parsedTimes.bookingStart}
              bookingEndTime={parsedTimes.bookingEnd}
              serviceWindowStart={parsedTimes.windowStart}
              serviceWindowEnd={parsedTimes.windowEnd}
              parsedBookingStart={parsedTimes.parsedBookingStart}
              parsedBookingEnd={parsedTimes.parsedBookingEnd}
              parsedServiceStart={parsedTimes.parsedWindowStart}
              parsedServiceEnd={parsedTimes.parsedWindowEnd}
            />

            <AllTablesSection
              groupedTables={groupedTables}
              filteredTables={filteredTables}
              totalCount={filteredTables.length}
              partySize={partySize}
              selectedTableIds={selectedTableIds}
              assignedTableIds={assignedTableIds}
              conflictedTableIds={conflictedTableIds}
              disabled={isPending}
              onToggle={handleToggleTable}
              bookingStartTime={parsedTimes.bookingStart}
              bookingEndTime={parsedTimes.bookingEnd}
              serviceWindowStart={parsedTimes.windowStart}
              serviceWindowEnd={parsedTimes.windowEnd}
              parsedBookingStart={parsedTimes.parsedBookingStart}
              parsedBookingEnd={parsedTimes.parsedBookingEnd}
              parsedServiceStart={parsedTimes.parsedWindowStart}
              parsedServiceEnd={parsedTimes.parsedWindowEnd}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm table assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to assign {selectedTables.length} table
              {selectedTables.length === 1 ? '' : 's'} for {partySize} covers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {validation.warnings.length > 0 && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-primary" aria-hidden />
                Warnings
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                {validation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApply}
              className="bg-primary/10 hover:bg-primary/10"
            >
              Confirm assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnassign} onOpenChange={setConfirmUnassign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assigned tables?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unassign all current tables for this booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnassign}
              className="bg-destructive/10 hover:bg-destructive/10"
            >
              Remove tables
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
