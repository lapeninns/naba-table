'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { useAssignmentContext } from '@/hooks/ops/useAssignmentContext';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import {
  buildAssignmentTableMap,
  calculateAssignmentSelectedCapacity,
  resolveAssignedTables,
  resolveBookingAssignmentError,
  resolveBookingAssignmentPreflight,
  resolveEffectiveSelectedIds,
} from './bookingAssignmentDomain';

import type { ManualSelectionCheck, ManualValidationResult } from '@/services/ops/bookings';
import type { OpsTodayBooking } from '@/types/ops';

type UseBookingAssignmentControllerParams = {
  readonly booking: OpsTodayBooking;
  readonly date: string;
  readonly onAssignmentComplete?: () => void;
  readonly onUnassignTable?: (tableId: string) => Promise<unknown>;
  readonly restaurantId: string;
};

export function useBookingAssignmentController({
  booking,
  date,
  onAssignmentComplete,
  onUnassignTable,
  restaurantId,
}: UseBookingAssignmentControllerParams) {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<ManualValidationResult | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [unassignTableId, setUnassignTableId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const prevSelectedTablesRef = useRef<string[]>([]);

  const {
    data: assignmentContext,
    isLoading: assignmentContextLoading,
    error: assignmentContextError,
    refetch: refetchAssignmentContext,
  } = useAssignmentContext({
    bookingId: booking.id,
    enabled: true,
  });

  const validationChecks = useMemo(() => {
    // Validation is now primarily handled by the backend on assignment.
    // This can be used for simple client-side checks if needed in the future.
    return [] as ManualSelectionCheck[];
  }, []);

  const tableMap = useMemo(
    () => buildAssignmentTableMap(assignmentContext?.tables),
    [assignmentContext?.tables],
  );

  const effectiveSelectedIds = useMemo(
    () =>
      resolveEffectiveSelectedIds({
        assignedTableIds: assignmentContext?.bookingAssignments ?? [],
        selectedTableIds: selectedTables,
      }),
    [assignmentContext?.bookingAssignments, selectedTables],
  );

  const selectedCapacity = useMemo(
    () =>
      calculateAssignmentSelectedCapacity({
        selectedTableIds: effectiveSelectedIds,
        tableMap,
      }),
    [effectiveSelectedIds, tableMap],
  );

  const assignedTables = useMemo(
    () =>
      resolveAssignedTables({
        assignedTableIds: assignmentContext?.bookingAssignments ?? [],
        tableMap,
      }),
    [assignmentContext?.bookingAssignments, tableMap],
  );

  const refreshAssignmentQueries = useCallback(
    () =>
      Promise.all([
        refetchAssignmentContext(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.opsBookings.assignmentContext(booking.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.opsDashboard.summary(restaurantId, date || null),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.list({}) }),
      ]),
    [booking.id, date, queryClient, refetchAssignmentContext, restaurantId],
  );

  const directAssignMutation = useMutation({
    mutationFn: async (tableIds: string[]) => {
      return await bookingService.assignTablesDirect({
        bookingId: booking.id,
        tableIds,
        idempotencyKey: generateIdempotencyKey(),
        requireAdjacency: false,
      });
    },
    onSuccess: async () => {
      setErrorBanner(null);
      setSelectedTables([]);
      setValidationResult(null);

      await refreshAssignmentQueries();

      onAssignmentComplete?.();
    },
    onError: (error: unknown) => {
      console.error('[BookingAssignmentTabContent] Assignment failed:', error);
      const resolution = resolveBookingAssignmentError(error, {
        partySize: booking.partySize,
        selectedCapacity,
        selectedTableIds: selectedTables,
      });

      if (resolution.kind === 'missing-tables') {
        setSelectedTables((prev) => prev.filter((id) => !resolution.missingTableIds.includes(id)));
        refetchAssignmentContext();
        setErrorBanner(resolution.message);
        return;
      }

      if (resolution.kind === 'validation' && resolution.validationResult) {
        setValidationResult(resolution.validationResult);
      }

      setErrorBanner(resolution.message);
    },
  });

  const handleToggleTable = useCallback((tableId: string) => {
    setSelectedTables((prev) => {
      if (prev.includes(tableId)) return prev.filter((id) => id !== tableId);
      return [...prev, tableId];
    });
  }, []);

  const handleAssign = useCallback(() => {
    const decision = resolveBookingAssignmentPreflight({
      assignedTableCount: assignedTables.length,
      selectedTableIds: selectedTables,
      tableMap,
    });

    if (decision.kind === 'already-assigned' || decision.kind === 'empty-selection') {
      setErrorBanner(decision.message);
      return;
    }

    if (decision.kind === 'stale-selection') {
      console.warn(
        '[BookingAssignmentTabContent] Detected stale table IDs, filtering and refreshing',
        {
          staleTableIds: decision.staleTableIds,
          validTableIds: decision.validTableIds,
        },
      );
      setSelectedTables(decision.validTableIds);
      refetchAssignmentContext();

      if (decision.message) {
        setErrorBanner(decision.message);
        return;
      }

      setErrorBanner(null);
      directAssignMutation.mutate(decision.validTableIds);
      return;
    }

    setErrorBanner(null);
    directAssignMutation.mutate(decision.tableIds);
  }, [
    assignedTables.length,
    selectedTables,
    tableMap,
    directAssignMutation,
    refetchAssignmentContext,
  ]);

  const handleClear = useCallback(() => {
    setSelectedTables([]);
    setValidationResult(null);
  }, []);

  const handleUnassignConfirm = useCallback(async () => {
    if (!unassignTableId || !onUnassignTable) return;

    try {
      await onUnassignTable(unassignTableId);
      await refreshAssignmentQueries();
      onAssignmentComplete?.();
    } catch (error) {
      console.error('[BookingAssignmentTabContent] Failed to unassign tables', error);
    } finally {
      setUnassignTableId(null);
    }
  }, [onAssignmentComplete, onUnassignTable, refreshAssignmentQueries, unassignTableId]);

  const handleRemoveAllTables = useCallback(async () => {
    if (assignedTables.length === 0) return;

    const tableIds = assignedTables.map((table) => table.id);

    try {
      await bookingService.unassignTablesDirect({
        bookingId: booking.id,
        tableIds,
      });

      await refreshAssignmentQueries();
      onAssignmentComplete?.();
    } catch (error) {
      console.error('[BookingAssignmentTabContent] Failed to remove all tables', error);
    }
  }, [assignedTables, booking.id, bookingService, onAssignmentComplete, refreshAssignmentQueries]);

  const handleUnassignDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setUnassignTableId(null);
  }, []);

  useEffect(() => {
    const prevSelection = prevSelectedTablesRef.current;
    const selectionChanged =
      prevSelection.length !== selectedTables.length ||
      !prevSelection.every((id) => selectedTables.includes(id));

    if (selectionChanged && validationResult) {
      setValidationResult(null);
    }

    prevSelectedTablesRef.current = selectedTables;
  }, [selectedTables, validationResult]);

  const isPending = assignmentContextLoading || directAssignMutation.isPending;
  const canAssign = selectedTables.length > 0 && !isPending && assignedTables.length === 0;

  return {
    assignedTables,
    assignmentContext,
    assignmentContextError,
    assignmentContextLoading,
    canAssign,
    directAssignPending: directAssignMutation.isPending,
    effectiveSelectedIds,
    errorBanner,
    handleAssign,
    handleClear,
    handleRemoveAllTables,
    handleToggleTable,
    handleUnassignConfirm,
    handleUnassignDialogOpenChange,
    isPending,
    onlyAvailable,
    refetchAssignmentContext,
    selectedCapacity,
    selectedTables,
    setOnlyAvailable,
    setUnassignTableId,
    unassignTableId,
    validationChecks,
    validationResult,
  };
}
