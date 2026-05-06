/**
 * useTableAssignment
 *
 * Encapsulates selection, validation, suggestions, and apply/unassign actions.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import { validateTableSelection } from '../utils';

import type { UseTableAssignmentOptions, UseTableAssignmentReturn } from '../types';
import type { AssignmentContext } from '@/services/ops/bookings';

const ASSIGNMENT_REALTIME_REFETCH_DEBOUNCE_MS = 250;
const ASSIGNMENT_REALTIME_REFETCH_DEDUPE_MS = 750;

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
  const queryClient = useQueryClient();
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

  // Realtime subscription for assignment context updates. Skipped when a
  // parent hook (e.g. `useOpsBookingDialogBundle`) is already maintaining a
  // consolidated channel that covers the same tables.
  useEffect(() => {
    const realtimeFlag = isRealtimeFloorplanEnabled();
    if (!bookingId || !restaurantId || !realtimeFlag || !enabled || !realtime) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channelName = `ops-table-assignment:${restaurantId}:${bookingId}`;
    const channel = client.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefreshAt = 0;
    const handleChange = () => {
      const now = Date.now();
      if (now - lastRefreshAt < ASSIGNMENT_REALTIME_REFETCH_DEDUPE_MS || refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        lastRefreshAt = Date.now();
        void refetch();
      }, ASSIGNMENT_REALTIME_REFETCH_DEBOUNCE_MS);
    };

    // Listen to allocations changes for this restaurant
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'allocations',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    // Listen to table holds for this restaurant
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'table_holds',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    // Listen to booking table assignments for this specific booking
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_table_assignments',
        filter: `booking_id=eq.${bookingId}`,
      },
      handleChange,
    );

    channel.subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      client.removeChannel(channel);
    };
  }, [bookingId, restaurantId, refetch, enabled, realtime]);

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

  const suggestedTables = useMemo(() => {
    // Step 1: Filter to only available, active, non-conflicted, non-assigned tables
    const candidates = tables.filter(
      (table) =>
        table.active &&
        table.status === 'available' &&
        !conflictedTableIds.has(table.id) &&
        !assignedTableIds.has(table.id),
    );

    if (candidates.length === 0) return [];

    // Step 2: Compute scarcity scores (tables with rare capacities are more "valuable")
    // Higher scarcity = rarer capacity = should be preserved for larger parties
    const capacityCounts = new Map<number, number>();
    for (const table of candidates) {
      const cap = table.capacity ?? 0;
      capacityCounts.set(cap, (capacityCounts.get(cap) ?? 0) + 1);
    }
    const totalTables = candidates.length;
    const scarcityScores = new Map<string, number>();
    for (const table of candidates) {
      const cap = table.capacity ?? 0;
      const count = capacityCounts.get(cap) ?? 1;
      // Scarcity: 1/count normalized - rarer tables have higher scarcity
      scarcityScores.set(table.id, count > 0 ? 1 / count : 0);
    }

    // Step 3: Score each table using algorithm-aligned scoring
    type ScoredTable = {
      table: (typeof candidates)[0];
      score: number;
      fit: 'exact' | 'comfort' | 'large' | 'undersized';
      overage: number;
      scarcity: number;
    };

    const scored: ScoredTable[] = [];

    for (const table of candidates) {
      const capacity = table.capacity ?? 0;
      const minPartySize = table.minPartySize ?? 1;
      const maxPartySize = table.maxPartySize ?? Infinity;

      // Skip tables that violate min/max party size constraints
      if (partySize < minPartySize) continue;
      if (maxPartySize !== null && maxPartySize > 0 && partySize > maxPartySize) continue;

      const overage = capacity - partySize;
      const scarcity = scarcityScores.get(table.id) ?? 0;

      // Determine fit category
      let fit: ScoredTable['fit'];
      if (overage === 0) {
        fit = 'exact';
      } else if (overage > 0 && overage <= 2) {
        fit = 'comfort';
      } else if (overage > 2) {
        fit = 'large';
      } else {
        fit = 'undersized'; // capacity < partySize
      }

      // Skip undersized tables for single-table suggestions
      if (fit === 'undersized') continue;

      // Compute composite score (lower is better)
      // Algorithm weights from selector.ts:
      // - overage penalty: penalize wasted seats
      // - scarcity penalty: penalize using rare tables when not needed
      // - preference for exact fit
      const OVERAGE_WEIGHT = 1.0;
      const SCARCITY_WEIGHT = 0.5;
      const EXACT_FIT_BONUS = -2.0; // negative = reward

      let score = 0;
      score += overage * OVERAGE_WEIGHT;
      score += scarcity * SCARCITY_WEIGHT * (totalTables > 1 ? 1 : 0); // only apply scarcity if multiple tables
      if (fit === 'exact') score += EXACT_FIT_BONUS;

      scored.push({
        table,
        score,
        fit,
        overage,
        scarcity,
      });
    }

    // Step 4: Sort by score (ascending - lower is better)
    // Tiebreakers: exact fit first, then lower overage, then table number for consistency
    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      // Prefer exact fit
      if (a.fit === 'exact' && b.fit !== 'exact') return -1;
      if (b.fit === 'exact' && a.fit !== 'exact') return 1;
      // Then lower overage
      if (a.overage !== b.overage) return a.overage - b.overage;
      // Then alphabetical table number for stable ordering
      return (a.table.tableNumber ?? '').localeCompare(b.table.tableNumber ?? '');
    });

    // Step 5: Return top 8 suggestions
    return scored.slice(0, 8).map((s) => s.table);
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsDashboard.summary(restaurantId, date ?? null),
        refetchType: 'active',
      });
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsDashboard.summary(restaurantId, date ?? null),
        refetchType: 'active',
      });
      onAssignmentComplete?.();
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Get auto-quote for optimal table selection
      const quoteResult = await bookingService.autoQuoteTables({
        bookingId,
        requireAdjacency: false,
      });

      if (
        !quoteResult.candidate ||
        !quoteResult.candidate.tableIds ||
        quoteResult.candidate.tableIds.length === 0
      ) {
        throw new Error(quoteResult.reason || 'No suitable tables found for this booking');
      }

      // Step 2: Directly assign the quoted tables
      return bookingService.assignTablesDirect({
        bookingId,
        tableIds: quoteResult.candidate.tableIds,
        idempotencyKey: generateIdempotencyKey(),
        requireAdjacency: false,
      });
    },
    onSuccess: () => {
      setSelectedTables([]);
      refetch();
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(bookingId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsDashboard.summary(restaurantId, date ?? null),
        refetchType: 'active',
      });
      onAssignmentComplete?.();
    },
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
    isPending:
      assignMutation.isPending || unassignMutation.isPending || autoAssignMutation.isPending,
  };
}
