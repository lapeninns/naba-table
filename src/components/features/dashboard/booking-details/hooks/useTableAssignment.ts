/**
 * useTableAssignment
 *
 * Encapsulates selection, validation, suggestions, and apply/unassign actions.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import { suggestAssignmentTables } from '../tableAssignmentSuggestionDomain';
import { validateTableSelection } from '../utils';
import { useTableAssignmentMutations } from './useTableAssignmentMutations';
import { useTableAssignmentRealtimeRefetch } from './useTableAssignmentRealtimeRefetch';

import type { UseTableAssignmentOptions, UseTableAssignmentReturn } from '../types';
import type { AssignmentContext } from '@/services/ops/bookings';

export function useTableAssignment({
  bookingId,
  restaurantId,
  partySize,
  date,
  currentAssignments = [],
  onAssignmentComplete,
  enabled = true,
  realtime = true,
}: UseTableAssignmentOptions): UseTableAssignmentReturn {
  const bookingService = useBookingService();

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const previousBookingIdRef = useRef<string | null>(null);

  const {
    data: context,
    isLoading,
    error,
    refetch,
  } = useQuery<AssignmentContext, Error>({
    queryKey: queryKeys.opsBookings.assignmentContext(bookingId),
    queryFn: () => bookingService.getAssignmentContext(bookingId),
    enabled: Boolean(bookingId) && enabled,
    staleTime: 30_000,
  });

  useTableAssignmentRealtimeRefetch({ bookingId, enabled, realtime, refetch, restaurantId });

  const tables = useMemo(() => context?.tables ?? [], [context?.tables]);

  const tableIdSet = useMemo(() => new Set(tables.map((table) => table.id)), [tables]);
  const selectedTableIdSet = useMemo(() => new Set(selectedTables), [selectedTables]);

  useEffect(() => {
    if (previousBookingIdRef.current && previousBookingIdRef.current !== bookingId) {
      setSelectedTables([]);
    }
    previousBookingIdRef.current = bookingId;
  }, [bookingId]);

  useEffect(() => {
    if (selectedTables.length === 0 || tableIdSet.size === 0) return;
    const filtered = selectedTables.filter((id) => tableIdSet.has(id));
    if (filtered.length !== selectedTables.length) {
      setSelectedTables(filtered);
    }
  }, [selectedTables, tableIdSet]);

  const assignedTableIds = useMemo(
    () => new Set(context?.bookingAssignments ?? currentAssignments),
    [context?.bookingAssignments, currentAssignments],
  );

  const conflictedTableIds = useMemo(
    () => new Set((context?.conflicts ?? []).map((conflict) => conflict.tableId)),
    [context?.conflicts],
  );

  const selectedTableObjects = useMemo(
    () => tables.filter((table) => selectedTableIdSet.has(table.id)),
    [selectedTableIdSet, tables],
  );

  const selectedCapacity = useMemo(
    () => selectedTableObjects.reduce((sum, table) => sum + table.capacity, 0),
    [selectedTableObjects],
  );

  const assignedCapacity = useMemo(
    () =>
      tables
        .filter((table) => assignedTableIds.has(table.id))
        .reduce((sum, table) => sum + table.capacity, 0),
    [assignedTableIds, tables],
  );

  const suggestedTables = useMemo(
    () => suggestAssignmentTables({ assignedTableIds, conflictedTableIds, partySize, tables }),
    [assignedTableIds, conflictedTableIds, partySize, tables],
  );

  const validation = useMemo(
    () =>
      validateTableSelection({
        partySize,
        selectedTables: selectedTableObjects,
        conflictedTableIds,
        hasExistingAssignments: assignedTableIds.size > 0,
      }),
    [assignedTableIds.size, conflictedTableIds, partySize, selectedTableObjects],
  );

  const { assignMutation, autoAssignMutation, isPending, unassignMutation } =
    useTableAssignmentMutations({
      bookingId,
      date,
      onAssignmentComplete,
      refetch,
      resetSelectedTables: () => setSelectedTables([]),
      restaurantId,
    });

  const apply = useCallback(async () => {
    if (selectedTables.some((id) => !tableIdSet.has(id))) {
      const filtered = selectedTables.filter((id) => tableIdSet.has(id));
      setSelectedTables(filtered);
      refetch();
      return { ok: false, error: 'Selected tables are no longer available. Please reselect.' };
    }
    if (selectedTables.length === 0) {
      return { ok: false, error: 'Select at least one table.' };
    }
    if (validation.errors.length > 0) {
      return { ok: false, error: validation.errors[0] };
    }
    try {
      await assignMutation.mutateAsync(selectedTables);
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpError && err.code === 'TABLES_NOT_FOUND') {
        setSelectedTables([]);
        refetch();
        return { ok: false, error: 'Some tables were removed. The list has been refreshed.' };
      }
      const message = err instanceof Error ? err.message : 'Failed to assign tables.';
      return { ok: false, error: message };
    }
  }, [assignMutation, refetch, selectedTables, tableIdSet, validation.errors]);

  const unassignAll = useCallback(async () => {
    if (assignedTableIds.size === 0) {
      return { ok: false, error: 'No tables assigned.' };
    }
    try {
      await unassignMutation.mutateAsync(Array.from(assignedTableIds));
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unassign tables.';
      return { ok: false, error: message };
    }
  }, [assignedTableIds, unassignMutation]);

  const autoAssign = useCallback(async () => {
    if (assignedTableIds.size > 0) {
      return { ok: false, error: 'Remove current table assignments before using smart assign.' };
    }
    try {
      await autoAssignMutation.mutateAsync();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Auto-assign failed.';
      return { ok: false, error: message };
    }
  }, [assignedTableIds, autoAssignMutation]);

  return {
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
    isAssigning: assignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
    isAutoAssigning: autoAssignMutation.isPending,
    isPending,
  };
}
