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
import { toUserMessage } from '@/lib/http/userMessage';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import { suggestAssignmentTables } from '../tableAssignmentSuggestionDomain';
import { validateTableSelection } from '../utils';
import { useTableAssignmentMutations } from './useTableAssignmentMutations';
import { useTableAssignmentRealtimeRefetch } from './useTableAssignmentRealtimeRefetch';

import type { UseTableAssignmentOptions, UseTableAssignmentReturn } from '../types';
import type { AssignmentContext } from '@/services/ops/bookings';

const ASSIGN_ERROR_COPY: Partial<Record<string, string>> = {
  TABLES_UNAVAILABLE: 'One of those tables was just taken. Pick another table.',
  ASSIGNMENT_CONFLICT: 'One of those tables was just taken. Pick another table.',
  HOLD_CONFLICT: 'One of those tables is held for another booking. Pick another table.',
  ASSIGNMENT_LOCKED: 'Tables are locked for past or completed bookings.',
  IDEMPOTENCY_KEY_REUSED: 'That change was already made with different tables. Refresh and try again.',
};

export function useTableAssignment({
  bookingId,
  restaurantId,
  partySize,
  currentAssignments = [],
  onAssignmentComplete,
  enabled = true,
  realtime = true,
}: UseTableAssignmentOptions): UseTableAssignmentReturn {
  const bookingService = useBookingService();

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const previousBookingIdRef = useRef<string | null>(null);
  // One idempotency key per "assign this selection" intent, reused if the same selection is
  // retried after a failure and dropped once it succeeds (C5).
  const assignDraftRef = useRef<{ signature: string; key: string } | null>(null);

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
      onAssignmentComplete,
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
    const signature = `${bookingId}:${[...selectedTables].sort().join(',')}`;
    if (assignDraftRef.current?.signature !== signature) {
      assignDraftRef.current = { signature, key: generateIdempotencyKey() };
    }
    try {
      await assignMutation.mutateAsync({
        bookingId,
        tableIds: selectedTables,
        idempotencyKey: assignDraftRef.current.key,
      });
      assignDraftRef.current = null;
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpError && err.code === 'TABLES_NOT_FOUND') {
        assignDraftRef.current = null;
        setSelectedTables([]);
        refetch();
        return { ok: false, error: 'Some tables were removed. The list has been refreshed.' };
      }
      return {
        ok: false,
        error: toUserMessage(err, { copy: ASSIGN_ERROR_COPY, fallback: 'Failed to assign tables.' }),
      };
    }
  }, [assignMutation, bookingId, refetch, selectedTables, tableIdSet, validation.errors]);

  const unassignAll = useCallback(async () => {
    if (assignedTableIds.size === 0) {
      return { ok: false, error: 'No tables assigned.' };
    }
    try {
      await unassignMutation.mutateAsync({ bookingId, tableIds: Array.from(assignedTableIds) });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: toUserMessage(err, { copy: ASSIGN_ERROR_COPY, fallback: 'Failed to unassign tables.' }),
      };
    }
  }, [assignedTableIds, bookingId, unassignMutation]);

  const autoAssign = useCallback(async () => {
    if (assignedTableIds.size > 0) {
      return { ok: false, error: 'Remove current table assignments before using smart assign.' };
    }
    try {
      await autoAssignMutation.mutateAsync({ bookingId, idempotencyKey: generateIdempotencyKey() });
      return { ok: true };
    } catch (err) {
      // Smart-assign "no tables" outcomes are client-side errors with safe copy.
      const message =
        err instanceof HttpError
          ? toUserMessage(err, { copy: ASSIGN_ERROR_COPY, fallback: 'Auto-assign failed.' })
          : err instanceof Error
            ? err.message
            : 'Auto-assign failed.';
      return { ok: false, error: message };
    }
  }, [assignedTableIds, autoAssignMutation, bookingId]);

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
