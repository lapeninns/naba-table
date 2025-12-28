/**
 * useTableAssignment
 *
 * Encapsulates selection, validation, suggestions, and apply/unassign actions.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import { validateTableSelection } from '../utils';

import type { UseTableAssignmentOptions, UseTableAssignmentReturn } from '../types';
import type { AssignmentContext } from '@/services/ops/bookings';

export function useTableAssignment({
  bookingId,
  restaurantId,
  partySize,
  currentAssignments = [],
  onAssignmentComplete,
}: UseTableAssignmentOptions): UseTableAssignmentReturn {
  const queryClient = useQueryClient();
  const bookingService = useBookingService();

  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const {
    data: context,
    isLoading,
    error,
    refetch,
  } = useQuery<AssignmentContext, Error>({
    queryKey: queryKeys.opsBookings.assignmentContext(bookingId),
    queryFn: () => bookingService.getAssignmentContext(bookingId),
    enabled: Boolean(bookingId),
    staleTime: 30_000,
  });

  const tables = useMemo(() => context?.tables ?? [], [context?.tables]);

  const assignedTableIds = useMemo(
    () => new Set(context?.bookingAssignments ?? currentAssignments),
    [context?.bookingAssignments, currentAssignments],
  );

  const conflictedTableIds = useMemo(
    () => new Set((context?.conflicts ?? []).map((conflict) => conflict.tableId)),
    [context?.conflicts],
  );

  const selectedTableObjects = useMemo(
    () => tables.filter((table) => selectedTables.includes(table.id)),
    [selectedTables, tables],
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

  const suggestedTables = useMemo(() => {
    const candidates = tables.filter(
      (table) =>
        table.active &&
        table.status === 'available' &&
        !conflictedTableIds.has(table.id) &&
        !assignedTableIds.has(table.id),
    );

    return candidates
      .filter((table) => table.capacity >= partySize)
      .sort((a, b) => Math.abs(a.capacity - partySize) - Math.abs(b.capacity - partySize))
      .slice(0, 8);
  }, [assignedTableIds, conflictedTableIds, partySize, tables]);

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

  const assignMutation = useMutation({
    mutationFn: async (tableIds: string[]) => {
      return bookingService.assignTablesDirect({
        bookingId,
        tableIds,
        idempotencyKey: generateIdempotencyKey(),
        requireAdjacency: false,
      });
    },
    onSuccess: () => {
      setSelectedTables([]);
      refetch();
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(bookingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsDashboard.summary(restaurantId, null) });
      onAssignmentComplete?.();
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (tableIds: string[]) => {
      return bookingService.unassignTablesDirect({ bookingId, tableIds });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(bookingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsDashboard.summary(restaurantId, null) });
      onAssignmentComplete?.();
    },
  });

  const apply = useCallback(async () => {
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
      const message = err instanceof Error ? err.message : 'Failed to assign tables.';
      return { ok: false, error: message };
    }
  }, [assignMutation, selectedTables, validation.errors]);

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
    isAssigning: assignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
    isPending: assignMutation.isPending || unassignMutation.isPending,
  };
}
