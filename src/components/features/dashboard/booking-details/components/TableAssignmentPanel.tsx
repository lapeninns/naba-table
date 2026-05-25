/**
 * TableAssignmentPanel
 *
 * Table selection UI with filters, warnings, and confirmation.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';

import { useTableAssignment } from '../hooks/useTableAssignment';
import {
  buildTableAssignmentInventoryView,
  createDefaultTableAssignmentFilters,
  parseTableAssignmentTimeline,
  type TableAssignmentFitFilter,
  type TableAssignmentSortOption,
} from '../tableAssignmentPanelDomain';
import { TableAssignmentAlerts } from './table-assignment/TableAssignmentAlerts';
import { TableAssignmentConfirmDialogs } from './table-assignment/TableAssignmentConfirmDialogs';
import { TableAssignmentFilters } from './table-assignment/TableAssignmentFilters';
import { TableAssignmentInventoryCanvas } from './table-assignment/TableAssignmentInventoryCanvas';
import {
  TableAssignmentEmptyState,
  TableAssignmentErrorState,
  TableAssignmentLoadingState,
} from './table-assignment/TableAssignmentPanelStateViews';
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

  const defaultFilters = useMemo(() => createDefaultTableAssignmentFilters(), []);
  const [zoneFilter, setZoneFilter] = useState(defaultFilters.zoneFilter);
  const [fitFilter, setFitFilter] = useState<TableAssignmentFitFilter>(defaultFilters.fitFilter);
  const [availabilityOnly, setAvailabilityOnly] = useState(defaultFilters.availabilityOnly);
  const [sortBy, setSortBy] = useState<TableAssignmentSortOption>(defaultFilters.sortBy);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [smartAssignError, setSmartAssignError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [srStatusMessage, setSrStatusMessage] = useState<string>('');
  const selectedTableIds = useMemo(() => new Set(selectedTables), [selectedTables]);
  const filters = useMemo(
    () => ({ availabilityOnly, fitFilter, sortBy, zoneFilter }),
    [availabilityOnly, fitFilter, sortBy, zoneFilter],
  );
  const parsedTimes = useMemo(
    () => parseTableAssignmentTimeline({ bookingEndTime, bookingStartTime, context }),
    [bookingEndTime, bookingStartTime, context],
  );
  const { filteredTables, groupedTables, zoneOptions } = useMemo(
    () =>
      buildTableAssignmentInventoryView({
        conflictedTableIds,
        filters,
        partySize,
        tables,
      }),
    [conflictedTableIds, filters, partySize, tables],
  );

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
    if (applyError) setApplyError(null);
    if (smartAssignError) setSmartAssignError(null);
    if (successMessage) setSuccessMessage(null);
  }, [selectedTables, assignedTableIds, applyError, smartAssignError, successMessage]);

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
    return <TableAssignmentLoadingState />;
  }

  if (error) {
    return <TableAssignmentErrorState error={error} onRetry={() => refetch()} />;
  }

  if (tables.length === 0) {
    return <TableAssignmentEmptyState />;
  }

  return (
    <section className="flex flex-col gap-6">
      <BookingOfflineBanner />

      <div className="sr-only" role="status" aria-live="polite">
        {srStatusMessage}
      </div>

      <div className="flex flex-col gap-5">
        {/* Zone 1: Control Rail — full-width compact strip */}
        <div className="flex flex-col gap-3">
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
              const nextFilters = createDefaultTableAssignmentFilters();
              setZoneFilter(nextFilters.zoneFilter);
              setFitFilter(nextFilters.fitFilter);
              setAvailabilityOnly(nextFilters.availabilityOnly);
              setSortBy(nextFilters.sortBy);
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
        <TableAssignmentInventoryCanvas
          assignedTableIds={assignedTableIds}
          conflictedTableIds={conflictedTableIds}
          disabled={isPending}
          filteredTables={filteredTables}
          groupedTables={groupedTables}
          onToggle={handleToggleTable}
          partySize={partySize}
          selectedTableIds={selectedTableIds}
          suggestedTables={suggestedTables}
          timeline={parsedTimes}
        />
      </div>

      <TableAssignmentConfirmDialogs
        confirmApplyOpen={confirmApply}
        confirmUnassignOpen={confirmUnassign}
        onConfirmApply={handleConfirmApply}
        onConfirmApplyOpenChange={setConfirmApply}
        onConfirmUnassign={handleConfirmUnassign}
        onConfirmUnassignOpenChange={setConfirmUnassign}
        partySize={partySize}
        selectedTableCount={selectedTables.length}
        warnings={validation.warnings}
      />
    </section>
  );
}
